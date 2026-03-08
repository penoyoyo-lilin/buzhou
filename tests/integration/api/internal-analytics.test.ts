/**
 * 内部 API 访问数据统计接口集成测试
 * GET /api/internal/v1/analytics
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/internal/v1/analytics/route'
import prisma from '@/core/db/client'

// Mock 环境变量
const TEST_API_KEY = 'test-internal-api-key-12345'

// 设置测试环境变量
vi.stubEnv('INTERNAL_API_KEY', TEST_API_KEY)

describe('Internal Analytics API Integration', () => {
  const testPageViews = [
    { path: '/zh/articles/test-1', referrer: 'https://google.com', isBot: false },
    { path: '/zh/articles/test-1', referrer: 'https://google.com', isBot: true },
    { path: '/zh/articles/test-2', referrer: null, isBot: false },
    { path: '/en/articles/test-3', referrer: 'https://github.com', isBot: false },
  ]

  const testApiRequests = [
    { endpoint: '/api/v1/search', method: 'GET', statusCode: 200, responseTime: 45, agentId: 'agent_test_1' },
    { endpoint: '/api/v1/search', method: 'GET', statusCode: 200, responseTime: 32, agentId: 'agent_test_1' },
    { endpoint: '/api/v1/search', method: 'GET', statusCode: 400, responseTime: 12, agentId: null },
    { endpoint: '/api/internal/v1/articles', method: 'POST', statusCode: 200, responseTime: 156, agentId: 'agent_test_2' },
  ]

  beforeAll(async () => {
    await prisma.$connect()

    // 创建测试页面浏览日志
    for (const pv of testPageViews) {
      await prisma.pageViewLog.create({
        data: {
          path: pv.path,
          referrer: pv.referrer,
          isBot: pv.isBot,
        },
      })
    }

    // 创建测试 API 请求日志
    for (const req of testApiRequests) {
      await prisma.apiRequestLog.create({
        data: {
          endpoint: req.endpoint,
          method: req.method,
          statusCode: req.statusCode,
          responseTime: req.responseTime,
          agentId: req.agentId,
        },
      })
    }
  })

  afterAll(async () => {
    // 清理测试数据
    await prisma.pageViewLog.deleteMany({
      where: { path: { contains: 'test' } },
    })
    await prisma.apiRequestLog.deleteMany({
      where: { endpoint: { contains: 'test' } },
    })
    await prisma.$disconnect()
  })

  describe('Authentication', () => {
    it('should reject request without Authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/internal/v1/analytics')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should reject request with invalid API key', async () => {
      const request = new NextRequest('http://localhost:3000/api/internal/v1/analytics', {
        headers: {
          Authorization: 'Bearer invalid-key',
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('should accept request with valid API key', async () => {
      const request = new NextRequest('http://localhost:3000/api/internal/v1/analytics', {
        headers: {
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('Query Parameters', () => {
    it('should validate granularity parameter', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/analytics?granularity=invalid',
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should validate type parameter', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/analytics?type=invalid',
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should accept valid query parameters', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/analytics?type=overview&granularity=day',
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('Response Structure', () => {
    it('should return all data types when type=all', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/analytics?type=all',
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toHaveProperty('overview')
      expect(data.data).toHaveProperty('traffic')
      expect(data.data).toHaveProperty('api')
      expect(data.data).toHaveProperty('articles')
    })

    it('should return only overview when type=overview', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/analytics?type=overview',
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveProperty('overview')
      expect(data.data).not.toHaveProperty('traffic')
      expect(data.data).not.toHaveProperty('api')
    })

    it('should return only traffic when type=traffic', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/analytics?type=traffic',
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveProperty('traffic')
      expect(data.data).not.toHaveProperty('overview')
      expect(data.data).not.toHaveProperty('articles')
    })

    it('should return only api when type=api', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/analytics?type=api',
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveProperty('api')
      expect(data.data).not.toHaveProperty('overview')
      expect(data.data).not.toHaveProperty('traffic')
    })

    it('should return only articles when type=articles', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/analytics?type=articles',
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data).toHaveProperty('articles')
      expect(data.data).not.toHaveProperty('overview')
      expect(data.data).not.toHaveProperty('traffic')
    })
  })

  describe('Overview Stats', () => {
    it('should return correct overview structure', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/analytics?type=overview',
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const overview = data.data.overview

      expect(overview).toHaveProperty('articles')
      expect(overview).toHaveProperty('views')
      expect(overview).toHaveProperty('apiRequests')
      expect(overview).toHaveProperty('agents')
      expect(overview).toHaveProperty('verifiers')
      expect(overview).toHaveProperty('period')

      expect(overview.articles).toHaveProperty('total')
      expect(overview.articles).toHaveProperty('published')
      expect(overview.views).toHaveProperty('total')
      expect(overview.views).toHaveProperty('inPeriod')
    })
  })

  describe('Traffic Stats', () => {
    it('should return correct traffic structure', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/analytics?type=traffic',
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const traffic = data.data.traffic

      expect(traffic).toHaveProperty('total')
      expect(traffic).toHaveProperty('humanViews')
      expect(traffic).toHaveProperty('botViews')
      expect(traffic).toHaveProperty('timeSeries')
      expect(traffic).toHaveProperty('topPages')
      expect(traffic).toHaveProperty('topReferrers')
      expect(traffic).toHaveProperty('granularity')

      expect(traffic.total).toBeGreaterThanOrEqual(4) // 至少有测试数据
      expect(Array.isArray(traffic.topPages)).toBe(true)
    })
  })

  describe('API Stats', () => {
    it('should return correct api stats structure', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/analytics?type=api',
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const apiStats = data.data.api

      expect(apiStats).toHaveProperty('total')
      expect(apiStats).toHaveProperty('success')
      expect(apiStats).toHaveProperty('errors')
      expect(apiStats).toHaveProperty('successRate')
      expect(apiStats).toHaveProperty('avgResponseTime')
      expect(apiStats).toHaveProperty('timeSeries')
      expect(apiStats).toHaveProperty('topEndpoints')
      expect(apiStats).toHaveProperty('granularity')

      expect(apiStats.total).toBeGreaterThanOrEqual(4) // 至少有测试数据
      expect(Array.isArray(apiStats.topEndpoints)).toBe(true)
    })

    it('should calculate success rate correctly', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/analytics?type=api',
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request)
      const data = await response.json()

      const apiStats = data.data.api

      // 测试数据: 3 success, 1 error
      expect(apiStats.success).toBeGreaterThanOrEqual(3)
      expect(apiStats.errors).toBeGreaterThanOrEqual(1)
      expect(apiStats.successRate).toBeGreaterThanOrEqual(50)
    })
  })

  describe('Articles Stats', () => {
    it('should return correct articles stats structure', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/analytics?type=articles',
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      const articles = data.data.articles

      expect(articles).toHaveProperty('byDomain')
      expect(articles).toHaveProperty('byVerification')
      expect(articles).toHaveProperty('newInPeriod')
      expect(articles).toHaveProperty('publishedInPeriod')
      expect(articles).toHaveProperty('topTags')

      expect(Array.isArray(articles.byDomain)).toBe(true)
      expect(Array.isArray(articles.byVerification)).toBe(true)
      expect(Array.isArray(articles.topTags)).toBe(true)
    })
  })

  describe('Response Meta', () => {
    it('should include requestId and timestamp in meta', async () => {
      const request = new NextRequest('http://localhost:3000/api/internal/v1/analytics', {
        headers: {
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await GET(request)
      const data = await response.json()

      expect(data).toHaveProperty('meta')
      expect(data.meta).toHaveProperty('requestId')
      expect(data.meta).toHaveProperty('timestamp')
    })
  })
})