import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const articleCountMock = vi.fn()
const agentCountMock = vi.fn()
const agentAggregateMock = vi.fn()
const apiRequestCountMock = vi.fn()

vi.mock('@/core/db/client', () => ({
  prisma: {
    article: { count: articleCountMock },
    agentApp: {
      count: agentCountMock,
      aggregate: agentAggregateMock,
    },
    apiRequestLog: { count: apiRequestCountMock },
  },
  default: {
    article: { count: articleCountMock },
    agentApp: {
      count: agentCountMock,
      aggregate: agentAggregateMock,
    },
    apiRequestLog: { count: apiRequestCountMock },
  },
}))

describe('Public stats API accuracy', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // article.count 调用顺序：published -> total -> verified -> weeklyNew
    articleCountMock
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4)

    agentCountMock.mockResolvedValue(5)
    apiRequestCountMock.mockResolvedValue(999)
    agentAggregateMock.mockResolvedValue({ _sum: { totalRequests: 12345 } })
  })

  it('should prefer apiRequestLog count as primary source', async () => {
    const { GET } = await import('@/app/api/v1/stats/route')

    const request = new NextRequest('http://localhost:3000/api/v1/stats')
    const response = await GET(request)
    const payload = await response.json() as {
      success: boolean
      data?: {
        apiRequests?: { total?: number; source?: string }
        articles?: { weeklyNew?: number }
      }
    }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)

    expect(payload.data?.apiRequests?.total).toBe(999)
    expect(payload.data?.apiRequests?.source).toBe('apiRequestLog')
    expect(payload.data?.articles?.weeklyNew).toBe(4)

    // weeklyNew 使用已发布口径
    expect(articleCountMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'published',
          OR: expect.any(Array),
        }),
      })
    )
  })

  it('should fallback to agentApp aggregate when apiRequestLog is unavailable', async () => {
    apiRequestCountMock.mockRejectedValueOnce(new Error('api_request_log missing'))

    const { GET } = await import('@/app/api/v1/stats/route')

    const request = new NextRequest('http://localhost:3000/api/v1/stats')
    const response = await GET(request)
    const payload = await response.json() as {
      success: boolean
      data?: {
        apiRequests?: { total?: number; source?: string }
      }
    }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.apiRequests?.total).toBe(12345)
    expect(payload.data?.apiRequests?.source).toBe('agentApp')
  })

  it('should return zero when both primary and fallback api request sources fail', async () => {
    apiRequestCountMock.mockRejectedValueOnce(new Error('api_request_log missing'))
    agentAggregateMock.mockRejectedValueOnce(new Error('agentApp aggregate failed'))

    const { GET } = await import('@/app/api/v1/stats/route')

    const request = new NextRequest('http://localhost:3000/api/v1/stats')
    const response = await GET(request)
    const payload = await response.json() as {
      success: boolean
      data?: {
        apiRequests?: { total?: number; source?: string }
      }
    }

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data?.apiRequests?.total).toBe(0)
    expect(payload.data?.apiRequests?.source).toBe('none')
  })
})
