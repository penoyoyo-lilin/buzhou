import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { prisma } from '@/core/db/client'
import { agentTrackingService } from '@/services/agent-tracking.service'

// 参数校验
const SearchSchema = z.object({
  q: z.string().min(1).optional(),
  domain: z.enum([
    // 原有领域分类
    'agent', 'mcp', 'skill',
    // MVP 内容分类
    'foundation', 'transport',
    'tools_filesystem', 'tools_postgres', 'tools_github',
    'error_codes', 'scenarios'
  ]).optional(),
  status: z.enum(['verified', 'partial', 'pending', 'failed', 'deprecated']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  lang: z.enum(['zh', 'en']).default('zh'),
})

async function withTracking(
  request: NextRequest,
  startTime: number,
  response: NextResponse
): Promise<NextResponse> {
  await agentTrackingService.trackPublicApiCall({
    request,
    endpoint: '/api/v1/search',
    method: request.method,
    statusCode: response.status,
    responseTimeMs: Date.now() - startTime,
  })
  return response
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  try {
    const { searchParams } = new URL(request.url)
    const params = SearchSchema.parse(Object.fromEntries(searchParams))

    // 构建查询条件
    const where: any = {
      status: 'published',
    }

    // 领域筛选
    if (params.domain) {
      where.domain = params.domain
    }

    // 验证状态筛选
    if (params.status) {
      where.verificationStatus = params.status
    }

    // 搜索条件
    if (params.q) {
      const query = params.q.toLowerCase()
      // SQLite 不支持全文搜索，使用 LIKE
      // 由于 JSON 字段存储，我们需要在应用层过滤
    }

    // 查询总数
    const total = await prisma.article.count({ where })

    // 分页查询
    const articles = await prisma.article.findMany({
      where,
      orderBy: [
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        domain: true,
        tags: true,
        verificationStatus: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    })

   // 辅助函数：安全解析 JSON 字段（兼容 PostgreSQL 和 SQLite）
  const parseJsonField = <T>(value: unknown, defaultValue: T): T => {
    if (!value) return defaultValue
    // PostgreSQL 的 Json 类型返回已解析的对象
    if (typeof value !== 'string') return value as T
    // SQLite 存储为 JSON 字符串，需要解析
    try {
      return JSON.parse(value) as T
    } catch {
      return defaultValue
    }
  }

   // PostgreSQL 的 Json 类型返回已解析的对象，SQLite 需要解析
   let results = articles.map((article) => ({
    ...article,
    title: parseJsonField(article.title, { zh: '', en: '' }),
    summary: parseJsonField(article.summary, { zh: '', en: '' }),
    tags: parseJsonField(article.tags, [] as string[]),
    metadata: parseJsonField(article.metadata, {}),
  }))

  // 如果有搜索词，在应用层过滤
    if (params.q) {
      const query = params.q.toLowerCase()
      results = results.filter((article) => {
        const titleMatch =
          article.title.zh?.toLowerCase().includes(query) ||
          article.title.en?.toLowerCase().includes(query)
        const summaryMatch =
          article.summary.zh?.toLowerCase().includes(query) ||
          article.summary.en?.toLowerCase().includes(query)
        const tagsMatch = article.tags?.some((t: string) => t.toLowerCase().includes(query))
        return titleMatch || summaryMatch || tagsMatch
      })
    }

    // 构建响应
    const items = results.map((article) => ({
      id: article.id,
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      domain: article.domain,
      tags: article.tags,
verificationStatus: article.verificationStatus,
confidenceScore: (article.metadata as any)?.confidenceScore || 0,
createdAt: article.createdAt.toISOString(),
updatedAt: article.updatedAt.toISOString(),
    }))

    const totalPages = Math.ceil(total / params.pageSize)

    const response = NextResponse.json(
      successResponse({
        items,
        pagination: {
          page: params.page,
          pageSize: params.pageSize,
          total,
          totalPages,
        },
      }),
      {
        headers: {
          'X-Agent-API-Endpoint': `${request.nextUrl.origin}/api/v1/search`,
          'X-Agent-API-Docs': `${request.nextUrl.origin}/${params.lang}/api-docs`,
        },
      }
    )
    return await withTracking(request, startTime, response)
  } catch (error) {
    console.error('Search API error:', error)

    if (error instanceof z.ZodError) {
      const response = NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, '参数验证失败', {
          errors: error.errors,
        }),
        { status: 400 }
      )
      return await withTracking(request, startTime, response)
    }

    const response = NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '服务器内部错误'),
      { status: 500 }
    )
    return await withTracking(request, startTime, response)
  }
}
