import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const verifyAdminAuthMock = vi.fn()

const articleCountMock = vi.fn()
const pageViewCountMock = vi.fn()
const pageViewFindManyMock = vi.fn()
const apiRequestCountMock = vi.fn()
const apiRequestFindManyMock = vi.fn()
const agentCountMock = vi.fn()
const verifierCountMock = vi.fn()

vi.mock('@/core/middleware/admin-auth', () => ({
  verifyAdminAuth: verifyAdminAuthMock,
}))

vi.mock('@/core/db/client', () => ({
  default: {
    article: { count: articleCountMock },
    pageViewLog: {
      count: pageViewCountMock,
      findMany: pageViewFindManyMock,
    },
    apiRequestLog: {
      count: apiRequestCountMock,
      findMany: apiRequestFindManyMock,
    },
    agentApp: { count: agentCountMock },
    verifier: { count: verifierCountMock },
  },
}))

describe('Admin stats API resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    verifyAdminAuthMock.mockResolvedValue({
      id: 'admin_1',
      email: 'admin@buzhou.io',
      role: 'admin',
    })

    articleCountMock
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6)

    pageViewCountMock
      .mockResolvedValueOnce(120)
      .mockResolvedValueOnce(25)
    pageViewFindManyMock.mockResolvedValue([
      { path: '/zh', isBot: false, createdAt: new Date('2026-03-12T01:00:00.000Z') },
      { path: '/zh', isBot: true, createdAt: new Date('2026-03-12T02:00:00.000Z') },
      { path: '/en', isBot: false, createdAt: new Date('2026-03-12T03:00:00.000Z') },
    ])

    apiRequestCountMock
      .mockResolvedValueOnce(300)
      .mockResolvedValueOnce(45)
    apiRequestFindManyMock.mockResolvedValue([
      { endpoint: '/api/v1/search', statusCode: 200, responseTime: 20, createdAt: new Date('2026-03-12T01:00:00.000Z') },
      { endpoint: '/api/v1/search', statusCode: 500, responseTime: 120, createdAt: new Date('2026-03-12T02:00:00.000Z') },
    ])

    agentCountMock.mockResolvedValue(3)
    verifierCountMock.mockResolvedValue(2)
  })

  it('should return 401 when admin auth fails', async () => {
    verifyAdminAuthMock.mockResolvedValueOnce(null)
    const { GET } = await import('@/app/api/admin/stats/route')

    const request = new NextRequest('http://localhost:3000/api/admin/stats?period=day')
    const response = await GET(request)
    const payload = await response.json() as { success: boolean }

    expect(response.status).toBe(401)
    expect(payload.success).toBe(false)
  })

  it('should degrade gracefully when log queries fail instead of returning 500', async () => {
    apiRequestCountMock.mockRejectedValue(new Error('api_request_log relation missing'))
    apiRequestFindManyMock.mockRejectedValue(new Error('api_request_log relation missing'))
    pageViewCountMock.mockRejectedValue(new Error('page_view_log relation missing'))
    pageViewFindManyMock.mockRejectedValue(new Error('page_view_log relation missing'))

    const { GET } = await import('@/app/api/admin/stats/route')

    const request = new NextRequest('http://localhost:3000/api/admin/stats?period=day')
    const response = await GET(request)
    const payload = await response.json() as {
      success: boolean
      data?: {
        overview?: { views?: { total?: number }; apiRequests?: { total?: number } }
        traffic?: { total?: number }
        api?: { total?: number }
      }
    }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)

    // 行级日志失败时，图表和排行应降级为可用默认值
    expect(payload.data?.traffic?.total).toBe(0)
    expect(payload.data?.api?.total).toBe(0)

    // 核心统计仍可返回
    expect(payload.data?.overview).toBeDefined()
  })

  it('should return 400 for invalid period', async () => {
    const { GET } = await import('@/app/api/admin/stats/route')

    const request = new NextRequest('http://localhost:3000/api/admin/stats?period=year')
    const response = await GET(request)
    const payload = await response.json() as { success: boolean }

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
  })
})
