import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const verifyAdminAuthMock = vi.fn()

const articleCountMock = vi.fn()
const pageViewCountMock = vi.fn()
const agentCountMock = vi.fn()
const verifierCountMock = vi.fn()
const pageViewFindManyMock = vi.fn()
const apiRequestCountMock = vi.fn()
const apiRequestFindManyMock = vi.fn()
const agentFindManyMock = vi.fn()

vi.mock('@/core/middleware/admin-auth', () => ({
  verifyAdminAuth: verifyAdminAuthMock,
}))

vi.mock('@/core/db/client', () => ({
  default: {
    article: { count: articleCountMock },
    pageViewLog: { count: pageViewCountMock, findMany: pageViewFindManyMock },
    apiRequestLog: { count: apiRequestCountMock, findMany: apiRequestFindManyMock },
    agentApp: { count: agentCountMock, findMany: agentFindManyMock },
    verifier: { count: verifierCountMock },
  },
}))

describe('Admin stats API details', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyAdminAuthMock.mockResolvedValue({ id: 'admin_1', email: 'admin@buzhou.io', role: 'admin' })
    articleCountMock.mockResolvedValue(10)
    agentCountMock.mockResolvedValue(2)
    verifierCountMock.mockResolvedValue(3)
    pageViewCountMock.mockResolvedValue(0)
    apiRequestCountMock.mockResolvedValue(0)
    pageViewFindManyMock.mockResolvedValue([])
    apiRequestFindManyMock.mockResolvedValue([])
    agentFindManyMock.mockResolvedValue([])
  })

  it('should return 400 when only one custom date bound is provided', async () => {
    const { GET } = await import('@/app/api/admin/stats/route')
    const request = new NextRequest('http://localhost:3000/api/admin/stats?startDate=2026-03-01')

    const response = await GET(request)
    const payload = await response.json() as { success: boolean; error?: { code?: string } }

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error?.code).toBe('VALIDATION_ERROR')
  })

  it('should return 400 when custom date range is invalid', async () => {
    const { GET } = await import('@/app/api/admin/stats/route')
    const request = new NextRequest('http://localhost:3000/api/admin/stats?startDate=2026-03-08&endDate=2026-03-01')

    const response = await GET(request)
    const payload = await response.json() as { success: boolean; error?: { code?: string } }

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error?.code).toBe('VALIDATION_ERROR')
  })

  it('should use in-period counts for top metrics and classify detail records', async () => {
    pageViewCountMock
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(30)
      .mockResolvedValueOnce(20)

    apiRequestCountMock
      .mockResolvedValueOnce(300)
      .mockResolvedValueOnce(80)

    pageViewFindManyMock.mockResolvedValue([
      { path: '/zh', referrer: null, userAgent: 'Mozilla/5.0', isBot: false, createdAt: new Date('2026-03-03T09:00:00.000Z') },
      { path: '/docs', referrer: 'https://google.com', userAgent: 'Googlebot/2.1', isBot: true, createdAt: new Date('2026-03-03T10:00:00.000Z') },
      { path: '/api', referrer: null, userAgent: 'ChatGPT-User/1.0', isBot: true, createdAt: new Date('2026-03-03T11:00:00.000Z') },
    ])

    apiRequestFindManyMock.mockResolvedValue([
      { agentId: null, endpoint: '/api/v1/search', method: 'GET', statusCode: 200, responseTime: 42, userAgent: 'Mozilla/5.0', createdAt: new Date('2026-03-03T09:00:00.000Z') },
      { agentId: 'agent_01', endpoint: '/api/v1/articles', method: 'POST', statusCode: 201, responseTime: 80, userAgent: 'ChatGPT-User/1.0', createdAt: new Date('2026-03-03T10:00:00.000Z') },
      { agentId: 'agent_02', endpoint: '/api/v1/search', method: 'GET', statusCode: 200, responseTime: 30, userAgent: 'curl/8.6.0', createdAt: new Date('2026-03-03T11:00:00.000Z') },
      { agentId: null, endpoint: '/api/v1/search', method: 'GET', statusCode: 503, responseTime: 25, userAgent: 'Bytespider', createdAt: new Date('2026-03-03T12:00:00.000Z') },
    ])

    agentFindManyMock.mockResolvedValue([
      { id: 'agent_01', externalAgentId: 'openai-assistant-prod' },
      { id: 'agent_02', externalAgentId: null },
    ])

    const { GET } = await import('@/app/api/admin/stats/route')
    const request = new NextRequest('http://localhost:3000/api/admin/stats?startDate=2026-03-01&endDate=2026-03-07')

    const response = await GET(request)
    const payload = await response.json() as {
      success: boolean
      data?: {
        overview?: { metrics?: { apiCalls: number; pageViews: number; humanViews: number; botViews: number } }
        period?: { type: string; start: string; end: string }
        traffic?: { timeSeries?: Array<{ time: string; count: number }> }
        details?: {
          apiCalls?: Array<{ endpoint: string; clientType: string; botVendor: string; source: string }>
          pageViews?: Array<{ path: string; clientType: string; botVendor: string }>
          botVendors?: {
            pageViews: Array<{ vendor: string; count: number }>
            apiCalls: Array<{ vendor: string; count: number }>
          }
        }
      }
    }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)

    expect(payload.data?.overview?.metrics).toEqual({
      apiCalls: 80,
      pageViews: 50,
      humanViews: 30,
      botViews: 20,
    })

    expect(payload.data?.period).toEqual({
      type: 'custom',
      start: '2026-03-01T00:00:00.000Z',
      end: '2026-03-07T23:59:59.999Z',
    })

    expect(payload.data?.traffic?.timeSeries?.every((item) => item.time.includes('-'))).toBe(true)

    const apiBotRecord = payload.data?.details?.apiCalls?.find((item) => item.endpoint === '/api/v1/articles')
    expect(apiBotRecord?.clientType).toBe('bot')
    expect(apiBotRecord?.botVendor).toBe('openai')
    expect(apiBotRecord?.source).toBe('openai-assistant-prod')

    const apiFallbackSource = payload.data?.details?.apiCalls?.find((item) => item.botVendor === 'other_bot')
    expect(apiFallbackSource?.source).toBe('Bot')

    const pageBotRecord = payload.data?.details?.pageViews?.find((item) => item.path === '/docs')
    expect(pageBotRecord?.clientType).toBe('bot')
    expect(pageBotRecord?.botVendor).toBe('google')

    expect(payload.data?.details?.botVendors?.pageViews).toEqual(
      expect.arrayContaining([
        { vendor: 'google', count: 1 },
        { vendor: 'openai', count: 1 },
      ])
    )
    expect(payload.data?.details?.botVendors?.apiCalls).toEqual(
      expect.arrayContaining([
        { vendor: 'openai', count: 1 },
        { vendor: 'bytedance', count: 1 },
        { vendor: 'other_bot', count: 1 },
      ])
    )

    expect(pageViewFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date('2026-03-01T00:00:00.000Z'),
            lt: new Date('2026-03-08T00:00:00.000Z'),
          },
        },
      })
    )
    expect(apiRequestFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: new Date('2026-03-01T00:00:00.000Z'),
            lt: new Date('2026-03-08T00:00:00.000Z'),
          },
        },
      })
    )
    expect(agentFindManyMock).toHaveBeenCalledWith({
      where: { id: { in: ['agent_01', 'agent_02'] } },
      select: { id: true, externalAgentId: true },
    })
  })

  it('should aggregate by hour for a single-day custom range', async () => {
    pageViewCountMock
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)

    apiRequestCountMock
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2)

    pageViewFindManyMock.mockResolvedValue([
      { path: '/zh', referrer: null, userAgent: 'Mozilla/5.0', isBot: false, createdAt: new Date('2026-03-03T01:00:00.000Z') },
      { path: '/zh', referrer: null, userAgent: 'Googlebot/2.1', isBot: true, createdAt: new Date('2026-03-03T02:00:00.000Z') },
    ])

    apiRequestFindManyMock.mockResolvedValue([])

    const { GET } = await import('@/app/api/admin/stats/route')
    const request = new NextRequest('http://localhost:3000/api/admin/stats?startDate=2026-03-03&endDate=2026-03-03')
    const response = await GET(request)
    const payload = await response.json() as { data?: { traffic?: { timeSeries?: Array<{ time: string }> } } }

    expect(response.status).toBe(200)
    const timeSeries = payload.data?.traffic?.timeSeries || []
    expect(timeSeries.length).toBeGreaterThan(0)
    expect(timeSeries.every((item) => /^\d{2}:00$/.test(item.time))).toBe(true)
  })
})
