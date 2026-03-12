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
  period: z.enum(['day', 'week', 'month']).optional().default('day'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const MAX_LOG_ROWS = 20000
const MAX_DETAIL_ROWS = 500

interface PageViewRow {
  path: string
  isBot: boolean
  referrer: string | null
  userAgent: string | null
  createdAt: Date
}

interface ApiRequestRow {
  endpoint: string
  method: string
  statusCode: number
  responseTime: number
  userAgent: string | null
  createdAt: Date
}

type ClientType = 'human' | 'bot'

type BotVendor =
  | 'human'
  | 'google'
  | 'bing'
  | 'bytedance'
  | 'openai'
  | 'anthropic'
  | 'perplexity'
  | 'other_bot'

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

function getBotVendor(userAgent: string): BotVendor {
  if (!userAgent) return 'other_bot'

  const ua = userAgent.toLowerCase()
  if (ua.includes('googlebot')) return 'google'
  if (ua.includes('bingbot')) return 'bing'
  if (ua.includes('bytespider') || ua.includes('bytedance')) return 'bytedance'
  if (ua.includes('openai') || ua.includes('chatgpt-user')) return 'openai'
  if (ua.includes('anthropic') || ua.includes('claude')) return 'anthropic'
  if (ua.includes('perplexity')) return 'perplexity'
  return 'other_bot'
}

function classifyPageViewClient(row: PageViewRow): { clientType: ClientType; botVendor: BotVendor } {
  if (!row.isBot) {
    return { clientType: 'human', botVendor: 'human' }
  }

  return {
    clientType: 'bot',
    botVendor: getBotVendor(row.userAgent || ''),
  }
}

function classifyApiClient(row: ApiRequestRow): { clientType: ClientType; botVendor: BotVendor } {
  const ua = (row.userAgent || '').toLowerCase()
  const looksLikeBot = /bot|crawler|spider|bytespider|openai|chatgpt-user|anthropic|claude|perplexity|curl|python-requests|wget/.test(ua)

  if (!looksLikeBot) {
    return { clientType: 'human', botVendor: 'human' }
  }

  return {
    clientType: 'bot',
    botVendor: getBotVendor(row.userAgent || ''),
  }
}

function parseDateOnly(input: string): Date {
  return new Date(`${input}T00:00:00.000Z`)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function aggregateBotVendors(items: Array<{ clientType: ClientType; botVendor: BotVendor }>) {
  const counts = new Map<BotVendor, number>()
  for (const item of items) {
    if (item.clientType !== 'bot') continue
    counts.set(item.botVendor, (counts.get(item.botVendor) || 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([vendor, count]) => ({ vendor, count }))
    .sort((a, b) => b.count - a.count)
}

function getGranularityForRange(startDate: Date, endDateExclusive: Date): 'hour' | 'day' {
  const diffMs = endDateExclusive.getTime() - startDate.getTime()
  const diffDays = diffMs / (24 * 60 * 60 * 1000)
  return diffDays <= 1 ? 'hour' : 'day'
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
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    })

    // 计算时间范围
    const now = new Date()
    let periodType: 'day' | 'week' | 'month' | 'custom' = params.period
    let startDate: Date
    let endDateExclusive: Date

    if (params.startDate || params.endDate) {
      if (!params.startDate || !params.endDate) {
        return Response.json(
          errorResponse(ErrorCodes.VALIDATION_ERROR, 'startDate 与 endDate 必须同时提供'),
          { status: 400 }
        )
      }

      startDate = parseDateOnly(params.startDate)
      endDateExclusive = addDays(parseDateOnly(params.endDate), 1)

      if (startDate >= endDateExclusive) {
        return Response.json(
          errorResponse(ErrorCodes.VALIDATION_ERROR, '日期范围无效：startDate 不能晚于 endDate'),
          { status: 400 }
        )
      }

      periodType = 'custom'
    } else {
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
      endDateExclusive = now
    }

    const timeRangeWhere = {
      createdAt: {
        gte: startDate,
        lt: endDateExclusive,
      },
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

    const [totalViews, viewsInPeriod, humanViewsInPeriod, botViewsInPeriod, pageViews] = await Promise.all([
      safeStatsQuery('pageView.total', () => prisma.pageViewLog.count(), 0),
      safeStatsQuery(
        'pageView.inPeriod',
        () => prisma.pageViewLog.count({ where: timeRangeWhere }),
        0
      ),
      safeStatsQuery(
        'pageView.humanInPeriod',
        () => prisma.pageViewLog.count({ where: { ...timeRangeWhere, isBot: false } }),
        0
      ),
      safeStatsQuery(
        'pageView.botInPeriod',
        () => prisma.pageViewLog.count({ where: { ...timeRangeWhere, isBot: true } }),
        0
      ),
      safeStatsQuery<PageViewRow[]>(
        'pageView.rows',
        () =>
          prisma.pageViewLog.findMany({
            where: timeRangeWhere,
            select: { path: true, referrer: true, userAgent: true, isBot: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: MAX_LOG_ROWS,
          }),
        []
      ),
    ])

    const [totalApiRequests, apiRequestsInPeriod, apiRequestLogs] = await Promise.all([
      safeStatsQuery('apiRequest.total', () => prisma.apiRequestLog.count(), 0),
      safeStatsQuery(
        'apiRequest.inPeriod',
        () => prisma.apiRequestLog.count({ where: timeRangeWhere }),
        0
      ),
      safeStatsQuery<ApiRequestRow[]>(
        'apiRequest.rows',
        () =>
          prisma.apiRequestLog.findMany({
            where: timeRangeWhere,
            select: { endpoint: true, method: true, statusCode: true, responseTime: true, userAgent: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take: MAX_LOG_ROWS,
          }),
        []
      ),
    ])

    const topPages = getTopPagesFromRows(pageViews)
    const topEndpoints = getTopEndpointsFromRows(apiRequestLogs)

    // 按时间聚合数据
    const granularity = getGranularityForRange(startDate, endDateExclusive)
    const trafficTimeSeries = aggregateByTime(pageViews, granularity, 'createdAt')
    const apiTimeSeries = aggregateByTime(apiRequestLogs, granularity, 'createdAt')

    // 计算人类访问和机器人访问
    const pageViewClassified = pageViews.map((row) => ({
      row,
      ...classifyPageViewClient(row),
    }))
    const apiRequestClassified = apiRequestLogs.map((row) => ({
      row,
      ...classifyApiClient(row),
    }))

    const pageViewDetails = pageViewClassified.slice(0, MAX_DETAIL_ROWS).map((item) => ({
      createdAt: item.row.createdAt.toISOString(),
      path: item.row.path,
      referrer: item.row.referrer,
      userAgent: item.row.userAgent,
      clientType: item.clientType,
      botVendor: item.botVendor,
    }))

    const apiCallDetails = apiRequestClassified.slice(0, MAX_DETAIL_ROWS).map((item) => ({
      createdAt: item.row.createdAt.toISOString(),
      endpoint: item.row.endpoint,
      method: item.row.method,
      statusCode: item.row.statusCode,
      responseTime: item.row.responseTime,
      userAgent: item.row.userAgent,
      clientType: item.clientType,
      botVendor: item.botVendor,
    }))

    const humanViews = humanViewsInPeriod
    const botViews = botViewsInPeriod
    const pageViewBotVendors = aggregateBotVendors(pageViewClassified)
    const apiCallBotVendors = aggregateBotVendors(apiRequestClassified)

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
          metrics: {
            apiCalls: apiRequestsInPeriod,
            pageViews: viewsInPeriod,
            humanViews,
            botViews,
          },
          agents: { active: activeAgents },
          verifiers: { active: activeVerifiers },
        },
        traffic: {
          total: viewsInPeriod,
          humanViews,
          botViews,
          timeSeries: trafficTimeSeries,
          topPages,
        },
        api: {
          total: apiRequestsInPeriod,
          successRate,
          avgResponseTime,
          timeSeries: apiTimeSeries,
          topEndpoints,
        },
        period: {
          type: periodType,
          start: startDate.toISOString(),
          end: new Date(endDateExclusive.getTime() - 1).toISOString(),
        },
        details: {
          apiCalls: apiCallDetails,
          pageViews: pageViewDetails,
          botVendors: {
            pageViews: pageViewBotVendors,
            apiCalls: apiCallBotVendors,
          },
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
