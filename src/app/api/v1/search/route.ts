import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { prisma } from '@/core/db/client'
import { agentTrackingService } from '@/services/agent-tracking.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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

type SearchListItem = {
  id: string
  slug: string
  title: { zh: string; en: string }
  summary: { zh: string; en: string }
  domain: string
  tags: string[]
  verificationStatus: string
  confidenceScore: number
  createdAt: string
  updatedAt: string
}

type RawSearchArticle = {
  id: string
  slug: string
  title: unknown
  summary: unknown
  domain: string
  tags: unknown
  verificationStatus?: string
  metadata?: unknown
  createdAt: unknown
  updatedAt: unknown
}

type ParsedSearchArticle = {
  id: string
  slug: string
  title: { zh: string; en: string }
  summary: { zh: string; en: string }
  domain: string
  tags: string[]
  verificationStatus?: string
  metadata?: Record<string, unknown>
  createdAt: unknown
  updatedAt: unknown
}

function toSafeISOString(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return new Date(0).toISOString()
}

function buildEmptyResponse(params: { page: number; pageSize: number }) {
  return successResponse({
    items: [] as SearchListItem[],
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total: 0,
      totalPages: 0,
    },
  })
}

function parseJsonField<T>(value: unknown, defaultValue: T): T {
  if (!value) return defaultValue
  if (typeof value !== 'string') return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return defaultValue
  }
}

function parseArticle(article: RawSearchArticle): ParsedSearchArticle {
  return {
    ...article,
    title: parseJsonField(article.title, { zh: '', en: '' }),
    summary: parseJsonField(article.summary, { zh: '', en: '' }),
    tags: parseJsonField(article.tags, [] as string[]),
    metadata: parseJsonField(article.metadata, {}),
  }
}

function matchesQuery(article: ParsedSearchArticle, query: string): boolean {
  const normalized = query.toLowerCase()
  const titleMatch =
    article.title.zh?.toLowerCase().includes(normalized) ||
    article.title.en?.toLowerCase().includes(normalized)
  const summaryMatch =
    article.summary.zh?.toLowerCase().includes(normalized) ||
    article.summary.en?.toLowerCase().includes(normalized)
  const tagsMatch = article.tags?.some((tag: string) => tag.toLowerCase().includes(normalized))
  return titleMatch || summaryMatch || tagsMatch
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

    let total = 0
    let articles: RawSearchArticle[] = []

    try {
      const baseSelect = {
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
      } as const

      if (params.q) {
        const allMatchedCandidates = await prisma.article.findMany({
          where,
          orderBy: [
            { publishedAt: 'desc' },
            { createdAt: 'desc' },
          ],
          select: baseSelect,
        })

        const filtered = allMatchedCandidates
          .map(parseArticle)
          .filter((article) => matchesQuery(article, params.q!))

        total = filtered.length
        const pageStart = (params.page - 1) * params.pageSize
        articles = filtered.slice(pageStart, pageStart + params.pageSize)
      } else {
        total = await prisma.article.count({ where })
        articles = await prisma.article.findMany({
          where,
          orderBy: [
            { publishedAt: 'desc' },
            { createdAt: 'desc' },
          ],
          skip: (params.page - 1) * params.pageSize,
          take: params.pageSize,
          select: baseSelect,
        })
      }
    } catch (dbError) {
      console.error('[SearchAPI] primary query failed, fallback to empty result:', dbError)
      const response = NextResponse.json(
        buildEmptyResponse({ page: params.page, pageSize: params.pageSize }),
        {
          headers: {
            'X-Agent-API-Endpoint': `${request.nextUrl.origin}/api/v1/search`,
            'X-Agent-API-Docs': `${request.nextUrl.origin}/${params.lang}/api-docs`,
          },
        }
      )
      return await withTracking(request, startTime, response)
    }

    const results = articles.map(parseArticle)

    // 构建响应
    const items: SearchListItem[] = results.map((article) => ({
      id: article.id,
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      domain: article.domain,
      tags: article.tags,
      verificationStatus: article.verificationStatus || 'pending',
      confidenceScore: (article.metadata as any)?.confidenceScore || 0,
      createdAt: toSafeISOString(article.createdAt),
      updatedAt: toSafeISOString(article.updatedAt),
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

    // 公开搜索接口失败时降级返回空结果，避免首页整体报错
    const fallbackParams = { page: 1, pageSize: 20 }
    const response = NextResponse.json(
      buildEmptyResponse(fallbackParams),
      {
        headers: {
          'X-Agent-API-Endpoint': `${request.nextUrl.origin}/api/v1/search`,
          'X-Agent-API-Docs': `${request.nextUrl.origin}/zh/api-docs`,
        },
      }
    )
    return await withTracking(request, startTime, response)
  }
}
