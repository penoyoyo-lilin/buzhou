/**
 * 管理后台 API: 访问统计数据
 * GET /api/admin/stats
 */

import { NextRequest } from 'next/server'
import { successResponse, errorResponse, ErrorCodes } from '@/lib/api-response'
import prisma from '@/core/db/client'
import { verifyAdminAuth } from '@/core/middleware/admin-auth'
import { z } from 'zod'

// 查询参数验证
const statsQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month']).default('day'),
})

const MAX_LOG_ROWS = 20000

interface PageViewRow {
  path: string
  isBot: boolean
  createdAt: Date
}

interface ApiRequestRow {
  endpoint: string
  statusCode: number
  responseTime: number
  createdAt: Date
}

async function safeStatsQuery<T>(
  label: string,
  query: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await query()
  } catch (error) {
    console.error(`[AdminStatsAPI] ${label} query failed:`, error)
    return fallback
  }
}

export async function GET(request: NextRequest) {
  try {
    // 验证管理员认证
    const admin = await verifyAdminAuth(request)
    if (!admin) {
      return Response.json(
        errorResponse(ErrorCodes.UNAUTHORIZED, '未授权访问'),
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const params = statsQuerySchema.parse({
      period: searchParams.get('period') || 'day',
    })

    // 计算时间范围
    const now = new Date()
    let startDate: Date
    switch (params.period) {
      case 'day':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
    }

    // 获取核心统计数据（降级容错，避免单点失败导致整体 500）
    const [
      totalArticles,
      publishedArticles,
      activeAgents,
      activeVerifiers,
    ] = await Promise.all([
      safeStatsQuery('article.total', () => prisma.article.count(), 0),
      safeStatsQuery(
        'article.published',
        () => prisma.article.count({ where: { status: 'published' } }),
        0
      ),
      safeStatsQuery(
        'agent.active',
        () => prisma.agentApp.count({ where: { status: 'active' } }),
        0
      ),
      safeStatsQuery(
        'verifier.active',
        () => prisma.verifier.count({ where: { status: 'active' } }),
        0
      ),
    ])

    const [totalViews, viewsInPeriod, pageViews] = await Promise.all([
      safeStatsQuery('pageView.total', () => prisma.pageViewLog.count(), 0),
      safeStatsQuery(
        'pageView.inPeriod',
        () => prisma.pageViewLog.count({ where: { createdAt: { gte: startDate } } }),
        0
      ),
      safeStatsQuery<PageViewRow[]>(
        'pageView.rows',
        () =>
          prisma.pageViewLog.findMany({
            where: { createdAt: { gte: startDate } },
            select: { path: true, isBot: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
            take: MAX_LOG_ROWS,
          }),
        []
      ),
    ])

    const [totalApiRequests, apiRequestsInPeriod, apiRequestLogs] = await Promise.all([
      safeStatsQuery('apiRequest.total', () => prisma.apiRequestLog.count(), 0),
      safeStatsQuery(
        'apiRequest.inPeriod',
        () => prisma.apiRequestLog.count({ where: { createdAt: { gte: startDate } } }),
        0
      ),
      safeStatsQuery<ApiRequestRow[]>(
        'apiRequest.rows',
        () =>
          prisma.apiRequestLog.findMany({
            where: { createdAt: { gte: startDate } },
            select: { endpoint: true, statusCode: true, responseTime: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
            take: MAX_LOG_ROWS,
          }),
        []
      ),
    ])

    const topPages = getTopPagesFromRows(pageViews)
    const topEndpoints = getTopEndpointsFromRows(apiRequestLogs)

    // 按时间聚合数据
    const granularity = params.period === 'day' ? 'hour' : 'day'
    const trafficTimeSeries = aggregateByTime(pageViews, granularity, 'createdAt')
    const apiTimeSeries = aggregateByTime(apiRequestLogs, granularity, 'createdAt')

    // 计算人类访问和机器人访问
    const humanViews = pageViews.filter((pv) => !pv.isBot).length
    const botViews = pageViews.filter((pv) => pv.isBot).length

    // API 成功率
    const successCount = apiRequestLogs.filter((r) => r.statusCode < 400).length
    const successRate =
      apiRequestLogs.length > 0
        ? Math.round((successCount / apiRequestLogs.length) * 100)
        : 0

    // 平均响应时间
    const avgResponseTime =
      apiRequestLogs.length > 0
        ? Math.round(
            apiRequestLogs.reduce((sum, r) => sum + r.responseTime, 0) / apiRequestLogs.length
          )
        : 0

    const logRowsCapped =
      pageViews.length >= MAX_LOG_ROWS || apiRequestLogs.length >= MAX_LOG_ROWS

    return Response.json(
      successResponse({
        overview: {
          articles: { total: totalArticles, published: publishedArticles },
          views: { total: totalViews, inPeriod: viewsInPeriod },
          apiRequests: { total: totalApiRequests, inPeriod: apiRequestsInPeriod },
          agents: { active: activeAgents },
          verifiers: { active: activeVerifiers },
        },
        traffic: {
          total: pageViews.length,
          humanViews,
          botViews,
          timeSeries: trafficTimeSeries,
          topPages,
        },
        api: {
          total: apiRequestLogs.length,
          successRate,
          avgResponseTime,
          timeSeries: apiTimeSeries,
          topEndpoints,
        },
        period: {
          type: params.period,
          start: startDate.toISOString(),
          end: now.toISOString(),
        },
        diagnostics: {
          logRowsCapped,
          maxLogRows: MAX_LOG_ROWS,
        },
      })
    )
  } catch (error) {
    console.error('Stats API error:', error)

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

/**
 * 从页面浏览数据计算热门页面
 */
function getTopPagesFromRows(pageViews: PageViewRow[]) {
  const pathCounts = new Map<string, number>()

  pageViews.forEach((pv) => {
    pathCounts.set(pv.path, (pathCounts.get(pv.path) || 0) + 1)
  })

  return Array.from(pathCounts.entries())
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)
}

/**
 * 从 API 请求数据计算热门端点
 */
function getTopEndpointsFromRows(apiRequests: ApiRequestRow[]) {
  const endpointStats = new Map<string, { count: number; errors: number; totalTime: number }>()

  apiRequests.forEach((req) => {
    const existing = endpointStats.get(req.endpoint) || { count: 0, errors: 0, totalTime: 0 }
    existing.count++
    existing.totalTime += req.responseTime
    if (req.statusCode >= 400) existing.errors++
    endpointStats.set(req.endpoint, existing)
  })

  return Array.from(endpointStats.entries())
    .map(([endpoint, stats]) => ({
      endpoint,
      requests: stats.count,
      avgResponseTime: Math.round(stats.totalTime / stats.count),
      errorRate: Math.round((stats.errors / stats.count) * 100),
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10)
}


/**
 * 按时间聚合数据
 */
function aggregateByTime<T>(
  data: T[],
  granularity: 'hour' | 'day',
  timeField: keyof T
): Array<{ time: string; count: number }> {
  const counts = new Map<string, number>()

  data.forEach((item) => {
    const rawTime = item[timeField]
    const date = rawTime instanceof Date ? rawTime : new Date(String(rawTime))
    if (Number.isNaN(date.getTime())) return

    const key =
      granularity === 'hour'
        ? `${date.getHours().toString().padStart(2, '0')}:00`
        : `${date.getMonth() + 1}-${date.getDate().toString().padStart(2, '0')}`
    counts.set(key, (counts.get(key) || 0) + 1)
  })

  return Array.from(counts.entries())
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => a.time.localeCompare(b.time))
}