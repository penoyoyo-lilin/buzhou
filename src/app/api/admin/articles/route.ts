export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { articleQuerySchema } from '@/lib/validators'
import { Prisma } from '@prisma/client'
import { articleService, CreateArticleData } from '@/services/article.service'
import { verificationService, CreateVerificationData } from '@/services/verification.service'
import { eventBus } from '@/core/events'
import { ensureArticleDomainEnumValue, isArticleDomainEnumValueError } from '@/core/db/article-domain'
import { nanoid } from 'nanoid'
import { z } from 'zod'

const CREATE_ARTICLE_DOMAINS = [
  'mcp',
  'skill',
  'foundation',
  'transport',
  'tools_filesystem',
  'tools_postgres',
  'tools_github',
  'error_codes',
  'scenarios',
] as const

const LEGACY_DOMAIN_ALIASES: Record<string, typeof CREATE_ARTICLE_DOMAINS[number]> = {
  'tools-filesystem': 'tools_filesystem',
  'tools-postgres': 'tools_postgres',
  'tools-github': 'tools_github',
  'error-codes': 'error_codes',
}

const DOMAIN_LEGACY_VALUES: Record<string, string> = {
  tools_filesystem: 'tools-filesystem',
  tools_postgres: 'tools-postgres',
  tools_github: 'tools-github',
  error_codes: 'error-codes',
}

function normalizeDomain(input: unknown): string {
  if (typeof input !== 'string') return ''
  const normalized = input.trim().toLowerCase()
  return LEGACY_DOMAIN_ALIASES[normalized] || normalized
}

function isDuplicateSlugError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  if (code === 'P2002' || code === '23505') {
    const metaTarget = (error as { meta?: { target?: unknown } }).meta?.target
    if (Array.isArray(metaTarget) && metaTarget.some((item) => String(item).includes('slug'))) {
      return true
    }
  }

  const message = error instanceof Error ? error.message : String(error)
  return (
    (/unique constraint failed/i.test(message) && /slug/i.test(message)) ||
    (/duplicate key value violates unique constraint/i.test(message) &&
      (/slug/i.test(message) || /articles_slug_key/i.test(message)))
  )
}

function isSchemaDriftError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  if (code === 'P2021' || code === 'P2022' || code === 'P2004' || code === 'P2010' || code === 'P2000') {
    return true
  }

  const message = error instanceof Error ? error.message : String(error)
  return (
    /column .+ does not exist/i.test(message) ||
    /table .+ does not exist/i.test(message) ||
    /check constraint/i.test(message) ||
    /invalid input value for enum/i.test(message) ||
    /null value in column .+ violates not-null constraint/i.test(message)
  )
}

function generateFallbackSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100)
  return slug || `article-${Date.now()}`
}

function getDomainCandidates(domain: string): string[] {
  const legacy = DOMAIN_LEGACY_VALUES[domain]
  return [domain, legacy].filter((value): value is string => Boolean(value))
}

interface SqlFallbackCreateResult {
  id: string
  slug: string
  domain: string
  status: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface SqlFallbackCreateInput {
  slug?: string
  title: { zh: string; en: string }
  summary: { zh: string; en: string }
  content: { zh: string; en: string }
  domain: string
  priority?: 'P0' | 'P1'
  status?: 'draft' | 'published' | 'archived'
  tags?: string[]
}

async function createArticleWithSqlFallback(
  data: SqlFallbackCreateInput,
  author: string
): Promise<SqlFallbackCreateResult> {
  const id = `art_${nanoid(12)}`
  const slug = data.slug || generateFallbackSlug(data.title.en)

  let columnSet: Set<string> | null = null
  try {
    const columns = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'articles'`
    )
    columnSet = new Set(columns.map((item) => item.column_name))
  } catch {
    columnSet = null
  }

  const resolveColumn = (...candidates: string[]): string | null => {
    if (!columnSet) return candidates[0] || null
    for (const candidate of candidates) {
      if (columnSet.has(candidate)) return candidate
    }
    return null
  }

  const now = new Date()
  const status = data.status || 'draft'
  const domainColumn = resolveColumn('domain')
  if (!domainColumn) {
    throw new Error('articles.domain column missing in database')
  }

  const baseRequiredFields: Array<{ column: string | null; value: unknown }> = [
    { column: resolveColumn('id'), value: id },
    { column: resolveColumn('slug'), value: slug },
    { column: resolveColumn('title'), value: JSON.stringify(data.title) },
    { column: resolveColumn('summary'), value: JSON.stringify(data.summary) },
    { column: resolveColumn('content'), value: JSON.stringify(data.content) },
    { column: resolveColumn('created_by', 'createdBy'), value: author },
  ]

  const extendedFields: Array<{ column: string | null; value: unknown }> = [
    { column: resolveColumn('tags'), value: JSON.stringify(data.tags || []) },
    { column: resolveColumn('keywords'), value: JSON.stringify([]) },
    { column: resolveColumn('code_blocks', 'codeBlocks'), value: JSON.stringify([]) },
    { column: resolveColumn('metadata'), value: JSON.stringify({
      applicableVersions: [],
      confidenceScore: 0,
      riskLevel: 'low',
      runtimeEnv: [],
    }) },
    { column: resolveColumn('qa_pairs', 'qaPairs'), value: JSON.stringify([]) },
    { column: resolveColumn('related_ids', 'relatedIds'), value: JSON.stringify([]) },
    { column: resolveColumn('priority'), value: data.priority || 'P1' },
    { column: resolveColumn('verification_status', 'verificationStatus'), value: 'pending' },
    { column: resolveColumn('status'), value: status },
    { column: resolveColumn('created_at', 'createdAt'), value: now },
    { column: resolveColumn('updated_at', 'updatedAt'), value: now },
  ]

  if (status === 'published') {
    extendedFields.push({ column: resolveColumn('published_at', 'publishedAt'), value: now })
  }

  const templateFieldGroups = [
    [...baseRequiredFields, ...extendedFields],
    [
      ...baseRequiredFields,
      { column: resolveColumn('tags'), value: JSON.stringify(data.tags || []) },
      { column: resolveColumn('priority'), value: data.priority || 'P1' },
      { column: resolveColumn('verification_status', 'verificationStatus'), value: 'pending' },
      { column: resolveColumn('status'), value: status },
      { column: resolveColumn('created_at', 'createdAt'), value: now },
      { column: resolveColumn('updated_at', 'updatedAt'), value: now },
    ],
    [
      ...baseRequiredFields,
      { column: resolveColumn('status'), value: status },
      { column: resolveColumn('created_at', 'createdAt'), value: now },
      { column: resolveColumn('updated_at', 'updatedAt'), value: now },
    ],
  ]

  for (const domainCandidate of getDomainCandidates(data.domain)) {
    for (const fields of templateFieldGroups) {
      const filteredFields = fields.filter((field): field is { column: string; value: unknown } => Boolean(field.column))
      const columnsWithDomain = filteredFields.map((field) => `"${field.column}"`).concat(`"${domainColumn}"`)
      const valuesWithDomain = filteredFields.map((field) => field.value).concat(domainCandidate)
      const placeholders = valuesWithDomain.map((_, index) => `$${index + 1}`).join(', ')

      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "articles" (${columnsWithDomain.join(', ')}) VALUES (${placeholders})`,
          ...valuesWithDomain
        )

        return {
          id,
          slug,
          domain: data.domain,
          status,
          createdBy: author,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        }
      } catch (error) {
        if (isDuplicateSlugError(error)) {
          throw error
        }
        if (!isSchemaDriftError(error)) {
          throw error
        }
      }
    }
  }

  throw new Error('Failed to create article with schema fallback')
}

// 辅助函数：安全解析 JSON 字段（兼容 PostgreSQL 和 SQLite）
function parseJsonField<T>(value: unknown, defaultValue: T): T {
  if (!value) return defaultValue
  if (typeof value !== 'string') return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return defaultValue
  }
}

// 创建文章请求验证
const createArticleSchema = z.object({
  slug: z.string().optional(),
  title: z.object({
    zh: z.string().min(1),
    en: z.string().min(1),
  }),
  summary: z.object({
    zh: z.string().min(1),
    en: z.string().min(1),
  }),
  content: z.object({
    zh: z.string().min(1),
    en: z.string().min(1),
  }),
  domain: z.preprocess(
    normalizeDomain,
    z.enum(CREATE_ARTICLE_DOMAINS)
  ),
  priority: z.enum(['P0', 'P1']).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  author: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  verificationRecords: z.array(z.object({
    verifierId: z.number().int().positive(),
    result: z.enum(['passed', 'failed', 'partial']),
    environment: z.object({
      os: z.string(),
      runtime: z.string(),
      version: z.string(),
    }),
    notes: z.string().optional(),
  })).optional(),
})

/**
 * GET /api/admin/articles
 * 获取文章列表
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const result = articleQuerySchema.safeParse({
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      domain: searchParams.get('domain') || undefined,
      verificationStatus: searchParams.get('verificationStatus') || undefined,
      page: searchParams.get('page') || '1',
      pageSize: searchParams.get('pageSize') || '20',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    })

    if (!result.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '参数验证失败', {
          errors: result.error.flatten().fieldErrors,
        }),
        { status: 400 }
      )
    }

    const { search, status, domain, verificationStatus, page, pageSize, sortBy, sortOrder } = result.data

    // 构建查询条件
    const where: Prisma.ArticleWhereInput = {}

    if (search) {
      // SQLite 不支持 mode: 'insensitive'，使用默认的大小写敏感搜索
      where.OR = [
        { id: { contains: search } },
        { slug: { contains: search } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (domain) {
      where.domain = domain as any
    }

    if (verificationStatus) {
      where.verificationStatus = verificationStatus
    }

    // 查询总数
    const total = await prisma.article.count({ where })

    // 查询列表
    const articles = await prisma.article.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        title: true,
        domain: true,
        status: true,
        verificationStatus: true,
        tags: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        featuredAt: true,
      },
    })

    // PostgreSQL 的 Json 类型返回已解析的对象，SQLite 需要解析
    const items = articles.map(article => ({
      ...article,
      title: parseJsonField(article.title, { zh: '', en: '' }),
      tags: parseJsonField(article.tags, [] as string[]),
    }))

    return NextResponse.json(
      successResponse({
        items,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      })
    )
  } catch (error) {
    console.error('Get articles error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取文章列表失败'),
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/articles
 * 创建文章
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证输入
    const validated = createArticleSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_INPUT, '参数验证失败', {
          errors: validated.error.flatten().fieldErrors,
        }),
        { status: 400 }
      )
    }

    const data = validated.data
    const author = data.author?.trim() || 'admin'

    let article: Awaited<ReturnType<typeof articleService.create>> | SqlFallbackCreateResult | null = null
    let usedSqlFallback = false
    try {
      article = await articleService.create({
        slug: data.slug,
        title: data.title,
        summary: data.summary,
        content: data.content,
        domain: data.domain,
        tags: data.tags,
        createdBy: author,
      } as CreateArticleData)
    } catch (rawCreateError) {
      let createError: unknown = rawCreateError
      let repairedCreateSucceeded = false
    
      if (isArticleDomainEnumValueError(createError, data.domain)) {
        const repaired = await ensureArticleDomainEnumValue(data.domain)
        if (repaired) {
          try {
            article = await articleService.create({
              slug: data.slug,
              title: data.title,
              summary: data.summary,
              content: data.content,
              domain: data.domain,
              tags: data.tags,
              createdBy: author,
            } as CreateArticleData)
            repairedCreateSucceeded = true
          } catch (retryError) {
            createError = retryError
          }
        }
      }
    
      if (!repairedCreateSucceeded) {
        if (isDuplicateSlugError(createError)) {
          return NextResponse.json(
            errorResponse(ErrorCodes.ALREADY_EXISTS, 'Slug 已存在，请更换后重试'),
            { status: 409 }
          )
        }
    
        if (isSchemaDriftError(createError)) {
          article = await createArticleWithSqlFallback(data, author)
          usedSqlFallback = true
        } else {
          throw createError
        }
      }
    }
    
    // 确保 article 已被赋值
    if (!article) {
      throw new Error('Failed to create article')
    }
    
    // 如果有验证记录，创建验证记录
    if (data.verificationRecords && data.verificationRecords.length > 0) {
      for (const record of data.verificationRecords) {
        await verificationService.createRecord({
          articleId: article.id,
          verifierId: record.verifierId,
          result: record.result,
          environment: record.environment,
          notes: record.notes,
        } as CreateVerificationData)
      }
    }

    // 如果状态为发布，更新状态
    if (!usedSqlFallback && data.status === 'published') {
      await articleService.publish(article.id, 'admin')
    }

    // 不阻塞主请求，异步触发 AI 生成链路
    void eventBus.emit(
      'article:created',
      {
        articleId: article.id,
        domain: data.domain,
        createdBy: author,
        status: data.status || 'draft',
        needsQAGeneration: true,
        needsRelatedGeneration: true,
        needsKeywordsGeneration: true,
      },
      {
        aggregateId: article.id,
        aggregateType: 'Article',
        source: 'admin-panel',
      }
    ).catch((eventError) => {
      console.error(`[ArticleCreateAPI] Failed to emit article:created for ${article.id}:`, eventError)
    })

    return NextResponse.json(successResponse(article))
  } catch (error) {
    console.error('Create article error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '创建文章失败'),
      { status: 500 }
    )
  }
}
