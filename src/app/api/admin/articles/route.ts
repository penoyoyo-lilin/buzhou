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
import { z } from 'zod'

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
  domain: z.enum([
    'mcp', 'skill',
    'foundation', 'transport',
    'tools_filesystem', 'tools_postgres', 'tools_github',
    'error_codes', 'scenarios',
  ]),
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

    // 创建文章
    const article = await articleService.create({
      slug: data.slug,
      title: data.title,
      summary: data.summary,
      content: data.content,
      domain: data.domain,
      tags: data.tags,
      createdBy: author,
    } as CreateArticleData)

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
    if (data.status === 'published') {
      await articleService.publish(article.id, 'admin')
    }

    // 发布事件触发异步生成任务
    await eventBus.emit(
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
    )

    return NextResponse.json(successResponse(article))
  } catch (error) {
    console.error('Create article error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '创建文章失败'),
      { status: 500 }
    )
  }
}
