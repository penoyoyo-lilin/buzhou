/**
 * 内部认证中间件测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { verifyInternalAuth } from '@/lib/internal-auth'
import { NextRequest } from 'next/server'

// Mock prisma
vi.mock('@/core/db/client', () => ({
  prisma: {
    systemConfig: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

import { prisma } from '@/core/db/client'

// Mock environment variables
const originalEnv = process.env

describe('internal-auth', () => {
  describe('verifyInternalAuth', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      process.env = { ...originalEnv }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should reject request without Authorization header', async () => {
      // Mock: no database key, no env key
      vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue(null)
      delete process.env.INTERNAL_API_KEY

      const request = new NextRequest('http://localhost/api/internal/v1/articles', {
        method: 'POST',
      })

      const result = await verifyInternalAuth(request)
      expect(result).toBe(false)
    })

    it('should reject request with wrong API key', async () => {
      vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue({
        id: '1',
        key: 'internal_api_key',
        value: 'test-api-key-12345',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new NextRequest('http://localhost/api/internal/v1/articles', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer wrong-key',
        },
      })

      const result = await verifyInternalAuth(request)
      expect(result).toBe(false)
    })

    it('should reject request with malformed Authorization header', async () => {
      vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue({
        id: '1',
        key: 'internal_api_key',
        value: 'test-api-key-12345',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new NextRequest('http://localhost/api/internal/v1/articles', {
        method: 'POST',
        headers: {
          Authorization: 'Basic test-api-key-12345',
        },
      })

      const result = await verifyInternalAuth(request)
      expect(result).toBe(false)
    })

    it('should accept request with correct API key from database', async () => {
      vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue({
        id: '1',
        key: 'internal_api_key',
        value: 'test-api-key-12345',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new NextRequest('http://localhost/api/internal/v1/articles', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key-12345',
        },
      })

      const result = await verifyInternalAuth(request)
      expect(result).toBe(true)
    })

    it('should accept request with correct API key from environment variable', async () => {
      // Mock: no database key, but env key exists
      vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue(null)
      process.env.INTERNAL_API_KEY = 'env-api-key-12345'

      const request = new NextRequest('http://localhost/api/internal/v1/articles', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer env-api-key-12345',
        },
      })

      const result = await verifyInternalAuth(request)
      expect(result).toBe(true)
    })

    it('should accept request with x-internal-api-key header', async () => {
      vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue({
        id: '1',
        key: 'internal_api_key',
        value: 'test-api-key-12345',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new NextRequest('http://localhost/api/internal/v1/articles', {
        method: 'POST',
        headers: {
          'x-internal-api-key': 'test-api-key-12345',
        },
      })

      const result = await verifyInternalAuth(request)
      expect(result).toBe(true)
    })

    it('should prioritize database key over environment variable', async () => {
      // Database has different key than env
      vi.mocked(prisma.systemConfig.findUnique).mockResolvedValue({
        id: '1',
        key: 'internal_api_key',
        value: 'database-key-12345',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      process.env.INTERNAL_API_KEY = 'env-key-12345'

      // Should accept database key
      const requestWithDbKey = new NextRequest('http://localhost/api/internal/v1/articles', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer database-key-12345',
        },
      })
      const resultDb = await verifyInternalAuth(requestWithDbKey)
      expect(resultDb).toBe(true)

      // Should reject env key when database has different key
      const requestWithEnvKey = new NextRequest('http://localhost/api/internal/v1/articles', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer env-key-12345',
        },
      })
      const resultEnv = await verifyInternalAuth(requestWithEnvKey)
      expect(resultEnv).toBe(false)
    })
  })
})