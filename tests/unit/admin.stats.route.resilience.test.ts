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

vi.mock('@/core/middleware/admin-auth', () => ({
  verifyAdminAuth: verifyAdminAuthMock,
}))

vi.mock('@/core/db/client', () => ({
  default: {
    article: { count: articleCountMock },
    pageViewLog: { count: pageViewCountMock, findMany: pageViewFindManyMock },
    apiRequestLog: { count: apiRequestCountMock, findMany: apiRequestFindManyMock },
    agentApp: { count: agentCountMock },
    verifier: { count: verifierCountMock },
  },
}))

describe('Admin stats API resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    verifyAdminAuthMock.mockResolvedValue({ id: 'admin_1', email: 'admin@buzhou.io', role: 'admin' })

    articleCountMock
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(8)

    pageViewCountMock
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(10)

    agentCountMock.mockResolvedValue(2)
    verifierCountMock.mockResolvedValue(3)

    pageViewFindManyMock.mockResolvedValue([
      { path: '/zh', isBot: false, createdAt: new Date('2026-03-11T01:00:00.000Z') },
    ])

    apiRequestCountMock.mockRejectedValue(new Error('P2021: table api_request_logs does not exist'))
    apiRequestFindManyMock.mockRejectedValue(new Error('P2021: table api_request_logs does not exist'))
  })

  it('should fallback to zero api metrics when api_request_logs table is missing', async () => {
    const { GET } = await import('@/app/api/admin/stats/route')
    const request = new NextRequest('http://localhost:3000/api/admin/stats?period=day')

    const response = await GET(request)
    const payload = await response.json() as {
      success: boolean
      data?: {
        overview?: { apiRequests?: { total: number; inPeriod: number } }
        api?: { total: number; topEndpoints?: unknown[] }
      }
    }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.overview?.apiRequests).toEqual({ total: 0, inPeriod: 0 })
    expect(payload.data?.api?.total).toBe(0)
    expect(payload.data?.api?.topEndpoints).toEqual([])
  })

  it('should return 400 for invalid period parameter', async () => {
    const { GET } = await import('@/app/api/admin/stats/route')
    const request = new NextRequest('http://localhost:3000/api/admin/stats?period=day:1')

    const response = await GET(request)
    const payload = await response.json() as { success: boolean; error?: { code?: string } }

    expect(response.status).toBe(400)
    expect(payload.success).toBe(false)
    expect(payload.error?.code).toBe('VALIDATION_ERROR')
  })
})
