/**
 * Health API 集成测试
 * 测试 GET /api/health
 */

import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/health/route'

describe('Health API Integration', () => {
  describe('GET /api/health', () => {
    it('应该返回健康状态', async () => {
      const request = new NextRequest('http://localhost:3000/api/health')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
    })

    it('应该返回数据库连接状态', async () => {
      const request = new NextRequest('http://localhost:3000/api/health')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.services).toBeDefined()
      expect(data.services.database).toBe('connected')
    })

    it('应该返回时间戳', async () => {
      const request = new NextRequest('http://localhost:3000/api/health')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.timestamp).toBeDefined()
    })
  })
})