import { NextRequest, NextResponse } from 'next/server'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { prisma } from '@/core/db/client'

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

/**
 * GET /api/v1/stats
 * 公开统计接口，无需认证
 * 返回文章数量、Agent 数量等公开统计数据
 */
export async function GET(request: NextRequest) {
  try {
    // 并行查询统计数据
    const [
      publishedArticlesCount,
      totalArticlesCount,
      activeAgentsCount,
      verifiedArticlesCount,
      apiRequests,
    ] = await Promise.all([
      // 已发布文章数量
      prisma.article.count({
        where: { status: 'published' },
      }),
      // 文章总数
      prisma.article.count(),
      // 活跃 Agent 数量
      prisma.agentApp.count({
        where: { status: 'active' },
      }),
      // 已验证文章数量
      prisma.article.count({
        where: { verificationStatus: 'verified' },
      }),
      // API 请求总数（优先日志口径，失败回退）
      getApiRequestsTotal(),
    ])

    // 计算本周新增已发布文章数（优先 publishedAt）
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const weeklyNewArticles = await prisma.article.count({
      where: {
        status: 'published',
        OR: [
          { publishedAt: { gte: oneWeekAgo } },
          {
            publishedAt: null,
            createdAt: { gte: oneWeekAgo },
          },
        ],
      },
    })

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

    return NextResponse.json(successResponse(stats))
  } catch (error) {
    console.error('Stats API error:', error)
    return NextResponse.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取统计数据失败'),
      { status: 500 }
    )
  }
}
