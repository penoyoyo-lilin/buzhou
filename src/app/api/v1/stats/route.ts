import { NextRequest, NextResponse } from 'next/server'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import { prisma } from '@/core/db/client'

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
      totalApiRequests,
      verifiedArticlesCount,
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
      // API 请求总数（从 AgentApp 的 stats 聚合）
      prisma.agentApp.aggregate({
        _sum: { totalRequests: true },
      }),
      // 已验证文章数量
      prisma.article.count({
        where: { verificationStatus: 'verified' },
      }),
    ])

    // 计算本周新增文章数
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

    const weeklyNewArticles = await prisma.article.count({
      where: {
        createdAt: {
          gte: oneWeekAgo,
        },
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
        total: totalApiRequests._sum.totalRequests || 0,
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