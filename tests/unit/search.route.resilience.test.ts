import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const articleCountMock = vi.fn()
const articleFindManyMock = vi.fn()
const trackPublicApiCallMock = vi.fn()

vi.mock('@/core/db/client', () => ({
  prisma: {
    article: {
      count: articleCountMock,
      findMany: articleFindManyMock,
    },
  },
  default: {
    article: {
      count: articleCountMock,
      findMany: articleFindManyMock,
    },
  },
}))

vi.mock('@/services/agent-tracking.service', () => ({
  agentTrackingService: {
    trackPublicApiCall: trackPublicApiCallMock,
  },
}))

describe('Search API resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    trackPublicApiCallMock.mockResolvedValue(undefined)
  })

  it('should degrade to empty result when query fails instead of returning 500', async () => {
    articleCountMock.mockRejectedValueOnce(new Error('relation "articles" not found'))

    const { GET } = await import('@/app/api/v1/search/route')
    const request = new NextRequest('http://localhost:3000/api/v1/search?pageSize=20')

    const response = await GET(request)
    const payload = await response.json() as {
      success: boolean
      data?: {
        items?: unknown[]
        pagination?: { total?: number }
      }
    }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.items).toEqual([])
    expect(payload.data?.pagination?.total).toBe(0)
    expect(articleFindManyMock).not.toHaveBeenCalled()
  })
})
