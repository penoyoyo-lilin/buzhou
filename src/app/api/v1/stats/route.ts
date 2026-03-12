import { NextRequest, NextResponse } from 'next/server'
import { successResponse } from '@/lib/api-response'
import { prisma } from '@/core/db/client'
import { agentTrackingService } from '@/services/agent-tracking.service'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
} as const

function buildDefaultStats() {
  return {
    articles: {
      total: 0,
      published: 0,
      verified: 0,
      weeklyNew: 0,
    },
    agents: {
      active: 0,
    },
    apiRequests: {
      total: 0,
      source: 'none' as const,
    },
  }
}

async function safeCount(
  key: string,
  fn: () => Promise<number>,
  fallback = 0
): Promise<number> {
  try {
    return await fn()
  } catch (error) {
    console.error(`[PublicStatsAPI] ${key} failed:`, error)
    return fallback
  }
}

async function getApiRequestsTotal(): Promise<{ total: number; source: 'apiRequestLog' | 'agentApp' | 'none' }> {
  try {
    const fromLog = await prisma.apiRequestLog.count()
    return {
      total: fromLog,
      source: 'apiRequestLog',
    }
  } catch (error) {
    console.error('[PublicStatsAPI] apiRequestLog.count failed, fallback to agentApp aggregate:', error)
    try {
      const fallback = await prisma.agentApp.aggregate({
        _sum: { totalRequests: true },
      })
      return {
        total: fallback._sum.totalRequests || 0,
        source: 'agentApp',
      }
    } catch (fallbackError) {
      console.error('[PublicStatsAPI] agentApp aggregate fallback failed:', fallbackError)
      return {
        total: 0,
        source: 'none',
      }
    }
  }
}

async function withTracking(
  request: NextRequest,
  startTime: number,
  response: NextResponse
): Promise<NextResponse> {
  await agentTrackingService.trackPublicApiCall({
    request,
    endpoint: '/api/v1/stats',
    method: request.method,
    statusCode: response.status,
    responseTimeMs: Date.now() - startTime,
  })
  return response
}

/**
 * GET /api/v1/stats
 * 公开统计接口，无需认证
 * 返回文章数量、Agent 数量等公开统计数据
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  try {
    const publishedWhere = {
      OR: [
        { status: 'published' as const },
        { publishedAt: { not: null } },
      ],
    }

    // 并行查询统计数据
    const [
      publishedArticlesCount,
      totalArticlesCount,
      activeAgentsCount,
      verifiedArticlesCount,
      apiRequests,
    ] = await Promise.all([
      safeCount('article.published', () =>
        prisma.article.count({
          where: publishedWhere,
        })
      ),
      safeCount('article.total', () => prisma.article.count()),
      safeCount('agent.active', () =>
        prisma.agentApp.count({
          where: { status: 'active' },
        })
      ),
      safeCount('article.verified', () =>
        prisma.article.count({
          where: {
            verificationStatus: 'verified',
            ...publishedWhere,
          },
        })
      ),
      // API 请求总数（优先日志口径，失败回退）
      getApiRequestsTotal(),
    ])

    // 计算本周新增已发布文章数（优先 publishedAt）
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const weeklyNewArticles = await safeCount('article.weeklyNew', () =>
      prisma.article.count({
        where: {
          OR: [
            {
              publishedAt: { gte: oneWeekAgo },
            },
            {
              publishedAt: null,
              status: 'published',
              createdAt: { gte: oneWeekAgo },
            },
          ],
        },
      })
    )

    const stats = {
      articles: {
        total: totalArticlesCount,
        published: publishedArticlesCount,
        verified: verifiedArticlesCount,
        weeklyNew: weeklyNewArticles,
      },
      agents: {
        active: activeAgentsCount,
      },
      apiRequests: {
        total: apiRequests.total,
        source: apiRequests.source,
      },
    }

    const response = NextResponse.json(successResponse(stats), {
      headers: NO_CACHE_HEADERS,
    })
    return await withTracking(request, startTime, response)
  } catch (error) {
    console.error('Stats API error:', error)
    const response = NextResponse.json(
      successResponse(buildDefaultStats()),
      {
        headers: NO_CACHE_HEADERS,
      }
    )
    return await withTracking(request, startTime, response)
  }
}
