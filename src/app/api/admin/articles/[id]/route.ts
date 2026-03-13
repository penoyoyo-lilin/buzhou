import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { toJsonValue, fromJsonValue } from '@/core/db/utils'

const ARTICLE_DOMAINS = [
  'agent',
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

const DOMAIN_ALIASES: Record<string, string> = {
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

function normalizeDomain(domain: unknown): string | null {
  if (typeof domain !== 'string') return null
  const trimmed = domain.trim()
  if (!trimmed) return null
  return DOMAIN_ALIASES[trimmed] || trimmed
}

function isValidDomain(domain: string): boolean {
  return (ARTICLE_DOMAINS as readonly string[]).includes(domain)
}

function isPostgreSQLRuntime(): boolean {
  const url = process.env.DATABASE_URL || ''
  return url.includes('postgresql://') || url.includes('postgres://')
}

function isDomainEnumDriftError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const code = (error as { code?: string }).code
  if (code === 'P2022' || code === 'P2010' || code === 'P2000') {
    return true
  }

  const message = error instanceof Error ? error.message : String(error)
  return (
    /invalid input value for enum\s+"?ArticleDomain"?/i.test(message) ||
    /value .* not found in enum.*ArticleDomain/i.test(message)
  )
}

async function resolveLegacyDomainIfNeeded(domain: string): Promise<string | null> {
  const legacy = DOMAIN_LEGACY_VALUES[domain]
  if (!legacy) return null

  const enumValues = await prisma.$queryRawUnsafe<Array<{ enumlabel: string }>>(
    `SELECT e.enumlabel
     FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'ArticleDomain'`
  )

  const labels = new Set(enumValues.map((item) => item.enumlabel))
  if (labels.has(domain)) return domain
  if (labels.has(legacy)) return legacy

  return null
}

/**
 * GET /api/admin/articles/[id]
 * 获取文章详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        verificationRecords: {
          include: {
            verifier: true,
          },
          orderBy: { verifiedAt: 'desc' },
        },
      },
    })

    if (!article) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '文章不存在'),
        { status: 404 }
      )
    }

    // PostgreSQL 的 Json 类型返回已解析的对象，SQLite 需要解析
    const parsedArticle = {
      ...article,
      author: article.createdBy,
      title: fromJsonValue(article.title, { zh: '', en: '' }),
      summary: fromJsonValue(article.summary, { zh: '', en: '' }),
      content: fromJsonValue(article.content, { zh: '', en: '' }),
      tags: fromJsonValue(article.tags, [] as string[]),
      keywords: fromJsonValue(article.keywords, [] as string[]),
      codeBlocks: fromJsonValue(article.codeBlocks, []),
      metadata: fromJsonValue(article.metadata, {}),
      qaPairs: fromJsonValue(article.qaPairs, []),
      relatedIds: fromJsonValue(article.relatedIds, [] as string[]),
      verificationRecords: (article.verificationRecords || []).map((record) => ({
        ...record,
        environment: fromJsonValue(record.environment, { os: '', runtime: '', version: '' }),
      })),
    }

    return NextResponse.json(successResponse(parsedArticle))
  } catch (error) {
    console.error('Get article error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取文章详情失败'),
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/articles/[id]
 * 更新文章
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    // 检查文章是否存在
    const existing = await prisma.article.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '文章不存在'),
        { status: 404 }
      )
    }

    // 构建更新数据（兼容 SQLite 和 PostgreSQL）
    const updateData: Record<string, unknown> = {}

    if (body.title) {
      updateData.title = toJsonValue(body.title)
    }
    if (body.summary) {
      updateData.summary = toJsonValue(body.summary)
    }
    if (body.content) {
      updateData.content = toJsonValue(body.content)
    }
    if (body.domain) {
      const normalizedDomain = normalizeDomain(body.domain)
      if (!normalizedDomain || !isValidDomain(normalizedDomain)) {
        return NextResponse.json(
          errorResponse(ErrorCodes.INVALID_INPUT, '参数验证失败', {
            errors: {
              domain: ['domain 不合法'],
            },
          }),
          { status: 400 }
        )
      }
      updateData.domain = normalizedDomain
    }
    if (body.tags !== undefined) {
      updateData.tags = toJsonValue(body.tags)
    }
    if (body.codeBlocks !== undefined) {
      updateData.codeBlocks = toJsonValue(body.codeBlocks)
    }
    if (body.metadata !== undefined) {
      updateData.metadata = toJsonValue(body.metadata)
    }
    if (body.qaPairs !== undefined) {
      updateData.qaPairs = toJsonValue(body.qaPairs)
    }
    if (body.relatedIds !== undefined) {
      updateData.relatedIds = toJsonValue(body.relatedIds)
    }
    if (body.status) {
      updateData.status = body.status
    }
    if (typeof body.author === 'string' && body.author.trim()) {
      updateData.createdBy = body.author.trim()
    }

    let article: Record<string, unknown> | null = null
    try {
      article = await prisma.article.update({
        where: { id },
        data: updateData,
      })
    } catch (updateError) {
      const normalizedDomain = typeof updateData.domain === 'string' ? updateData.domain : null
      if (isPostgreSQLRuntime() && normalizedDomain && isDomainEnumDriftError(updateError)) {
        const writableDomain = await resolveLegacyDomainIfNeeded(normalizedDomain)
        if (writableDomain) {
          // 先更新除 domain 外字段，避免 domain 枚举漂移阻塞其他字段更新
          const { domain: _domain, ...nonDomainData } = updateData
          if (Object.keys(nonDomainData).length > 0) {
            await prisma.article.update({
              where: { id },
              data: nonDomainData,
            })
          }

          await prisma.$executeRawUnsafe(
            `UPDATE "articles" SET "domain" = '${writableDomain}'::"ArticleDomain", "updated_at" = NOW() WHERE "id" = $1`,
            id
          )

          const fallbackArticle = await prisma.article.findUnique({ where: { id } })
          if (fallbackArticle) {
            article = {
              ...fallbackArticle,
              // 对外保持新规范，避免前端拿到 legacy 值
              domain: normalizedDomain,
            } as Record<string, unknown>
          }
        }
      }

      if (!article) {
        throw updateError
      }
    }

    return NextResponse.json(successResponse(article))
  } catch (error) {
    console.error('Update article error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '更新文章失败'),
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/articles/[id]
 * 删除文章
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // 检查文章是否存在
    const existing = await prisma.article.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, '文章不存在'),
        { status: 404 }
      )
    }

    await prisma.article.delete({
      where: { id },
    })

    return NextResponse.json(successResponse(null))
  } catch (error) {
    console.error('Delete article error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '删除文章失败'),
      { status: 500 }
    )
  }
}
