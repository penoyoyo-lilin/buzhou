/**
 * 内部 API: 社区访问数据统计
 * GET /api/internal/v1/analytics
 */

import { NextRequest } from 'next/server'
import { verifyInternalAuth } from '@/lib/internal-auth'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import prisma from '@/core/db/client'
import { z } from 'zod'

// 查询参数验证
const analyticsQuerySchema = z.object({
  // 时间范围
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  // 聚合粒度
  granularity: z.enum(['hour', 'day', 'week', 'month']).default('day'),
  // 数据类型过滤
  type: z.enum(['overview', 'traffic', 'api', 'articles', 'all']).default('all'),
  // 分页（用于详细数据）
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export async function GET(request: NextRequest) {
  // 验证内部 API 认证
  if (!verifyInternalAuth(request)) {
    return Response.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, '无效的内部 API 密钥'),
      { status: 401 }
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const params = analyticsQuerySchema.parse(Object.fromEntries(searchParams))

    // 解析时间范围
    const endDate = params.endDate ? new Date(params.endDate) : new Date()
    const startDate = params.startDate
      ? new Date(params.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000) // 默认最近 30 天

    const result: Record<string, unknown> = {}

    // 根据类型返回不同数据
    if (params.type === 'all' || params.type === 'overview') {
      result.overview = await getOverviewStats(startDate, endDate)
    }

    if (params.type === 'all' || params.type === 'traffic') {
      result.traffic = await getTrafficStats(startDate, endDate, params.granularity)
    }

    if (params.type === 'all' || params.type === 'api') {
      result.api = await getApiStats(startDate, endDate, params.granularity)
    }

    if (params.type === 'all' || params.type === 'articles') {
      result.articles = await getArticleStats(startDate, endDate)
    }

    return Response.json(successResponse(result))
  } catch (error) {
    console.error('Analytics API error:', error)

    if (error instanceof z.ZodError) {
      return Response.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, '参数验证失败', {
          errors: error.errors,
        }),
        { status: 400 }
      )
    }

    return Response.json(
      errorResponse(ErrorCodes.INTERNAL_ERROR, '获取统计数据失败'),
      { status: 500 }
    )
  }
}

// ============================================
// 统计查询函数
// ============================================

/**
 * 获取概览统计
 */
async function getOverviewStats(startDate: Date, endDate: Date) {
  const [
    totalArticles,
    publishedArticles,
    totalViews,
    totalApiRequests,
    activeAgents,
    totalVerifiers,
    pageViewsInPeriod,
    apiRequestsInPeriod,
  ] = await Promise.all([
    // 文章总数
    prisma.article.count(),
    // 已发布文章数
    prisma.article.count({ where: { status: 'published' } }),
    // 总浏览量
    prisma.pageViewLog.count(),
    // 总 API 请求数
    prisma.apiRequestLog.count(),
    // 活跃 Agent 数
    prisma.agentApp.count({ where: { status: 'active' } }),
    // 验证人总数
    prisma.verifier.count({ where: { status: 'active' } }),
    // 时间范围内浏览量
    prisma.pageViewLog.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    // 时间范围内 API 请求数
    prisma.apiRequestLog.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
  ])

  return {
    articles: {
      total: totalArticles,
      published: publishedArticles,
    },
    views: {
      total: totalViews,
      inPeriod: pageViewsInPeriod,
    },
    apiRequests: {
      total: totalApiRequests,
      inPeriod: apiRequestsInPeriod,
    },
    agents: {
      active: activeAgents,
    },
    verifiers: {
      active: totalVerifiers,
    },
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
  }
}

/**
 * 获取流量统计
 */
async function getTrafficStats(
  startDate: Date,
  endDate: Date,
  granularity: 'hour' | 'day' | 'week' | 'month'
) {
  // 查询时间范围内的页面浏览日志
  const pageViews = await prisma.pageViewLog.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      path: true,
      referrer: true,
      isBot: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // 按时间聚合
  const timeSeries = aggregateByTime(pageViews, granularity, 'createdAt')

  // 按路径分组统计 Top 页面
  const pathCounts = new Map<string, number>()
  pageViews.forEach((pv) => {
    pathCounts.set(pv.path, (pathCounts.get(pv.path) || 0) + 1)
  })
  const topPages = Array.from(pathCounts.entries())
    .map(([path, count]) => ({ path, views: count }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)

  // 来源统计
  const referrerCounts = new Map<string, number>()
  pageViews.forEach((pv) => {
    if (pv.referrer) {
      referrerCounts.set(pv.referrer, (referrerCounts.get(pv.referrer) || 0) + 1)
    }
  })
  const topReferrers = Array.from(referrerCounts.entries())
    .map(([referrer, count]) => ({ referrer, views: count }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)

  // 机器人访问统计
  const botCount = pageViews.filter((pv) => pv.isBot).length

  return {
    total: pageViews.length,
    humanViews: pageViews.length - botCount,
    botViews: botCount,
    timeSeries,
    topPages,
    topReferrers,
    granularity,
  }
}

/**
 * 获取 API 统计
 */
async function getApiStats(
  startDate: Date,
  endDate: Date,
  granularity: 'hour' | 'day' | 'week' | 'month'
) {
  // 查询时间范围内的 API 请求日志
  const apiRequests = await prisma.apiRequestLog.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    select: {
      endpoint: true,
      method: true,
      statusCode: true,
      responseTime: true,
      agentId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // 按时间聚合
  const timeSeries = aggregateByTime(apiRequests, granularity, 'createdAt')

  // 按端点分组统计
  const endpointCounts = new Map<
    string,
    { count: number; avgResponseTime: number; errors: number }
  >()
  apiRequests.forEach((req) => {
    const existing = endpointCounts.get(req.endpoint) || {
      count: 0,
      avgResponseTime: 0,
      errors: 0,
    }
    existing.count++
    existing.avgResponseTime =
      (existing.avgResponseTime * (existing.count - 1) + req.responseTime) / existing.count
    if (req.statusCode >= 400) {
      existing.errors++
    }
    endpointCounts.set(req.endpoint, existing)
  })

  const topEndpoints = Array.from(endpointCounts.entries())
    .map(([endpoint, stats]) => ({
      endpoint,
      requests: stats.count,
      avgResponseTime: Math.round(stats.avgResponseTime),
      errorRate: Math.round((stats.errors / stats.count) * 100),
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10)

  // 成功率统计
  const successCount = apiRequests.filter((r) => r.statusCode < 400).length
  const errorCount = apiRequests.length - successCount

  // 平均响应时间
  const avgResponseTime =
    apiRequests.length > 0
      ? Math.round(
          apiRequests.reduce((sum, r) => sum + r.responseTime, 0) / apiRequests.length
        )
      : 0

  // Agent 使用统计
  const agentCounts = new Map<string, number>()
  apiRequests.forEach((req) => {
    if (req.agentId) {
      agentCounts.set(req.agentId, (agentCounts.get(req.agentId) || 0) + 1)
    }
  })

  return {
    total: apiRequests.length,
    success: successCount,
    errors: errorCount,
    successRate:
      apiRequests.length > 0 ? Math.round((successCount / apiRequests.length) * 100) : 0,
    avgResponseTime,
    timeSeries,
    topEndpoints,
    agentsWithRequests: agentCounts.size,
    granularity,
  }
}

/**
 * 获取文章统计
 */
async function getArticleStats(startDate: Date, endDate: Date) {
  // 按领域统计文章数
  const articlesByDomain = await prisma.article.groupBy({
    by: ['domain'],
    _count: { id: true },
    where: { status: 'published' },
  })

  // 按验证状态统计
  const articlesByVerification = await prisma.article.groupBy({
    by: ['verificationStatus'],
    _count: { id: true },
    where: { status: 'published' },
  })

  // 时间范围内新增文章
  const newArticles = await prisma.article.count({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
  })

  // 时间范围内发布文章
  const publishedInPeriod = await prisma.article.count({
    where: {
      publishedAt: { gte: startDate, lte: endDate },
      status: 'published',
    },
  })

  // 标签热度统计
  const allArticles = await prisma.article.findMany({
    where: { status: 'published' },
    select: { tags: true },
  })

  const tagCounts = new Map<string, number>()
  allArticles.forEach((article) => {
    // PostgreSQL 的 Json 类型返回已解析的对象
    const tags = Array.isArray(article.tags) ? (article.tags as string[]) : []
    tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
    })
  })

  const topTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)

  return {
    byDomain: articlesByDomain.map((item) => ({
      domain: item.domain,
      count: item._count.id,
    })),
    byVerification: articlesByVerification.map((item) => ({
      status: item.verificationStatus,
      count: item._count.id,
    })),
    newInPeriod: newArticles,
    publishedInPeriod,
    topTags,
  }
}

/**
 * 按时间聚合数据
 */
function aggregateByTime<T extends Record<string, unknown>>(
  data: T[],
  granularity: 'hour' | 'day' | 'week' | 'month',
  timeField: keyof T
): Array<{ time: string; count: number }> {
  const counts = new Map<string, number>()

  data.forEach((item) => {
    const date = item[timeField] as Date
    const key = getTimeKey(date, granularity)
    counts.set(key, (counts.get(key) || 0) + 1)
  })

  return Array.from(counts.entries())
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => a.time.localeCompare(b.time))
}

/**
 * 获取时间键
 */
function getTimeKey(date: Date, granularity: 'hour' | 'day' | 'week' | 'month'): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')

  switch (granularity) {
    case 'hour':
      return `${year}-${month}-${day}T${hour}:00`
    case 'day':
      return `${year}-${month}-${day}`
    case 'week':
      const weekNum = getWeekNumber(date)
      return `${year}-W${String(weekNum).padStart(2, '0')}`
    case 'month':
      return `${year}-${month}`
    default:
      return `${year}-${month}-${day}`
  }
}

/**
 * 获取周数
 */
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
}