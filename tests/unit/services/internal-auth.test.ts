/**
 * 内部认证中间件测试
 */

import { describe, it, expect } from 'vitest'
import { verifyInternalAuth } from '@/lib/internal-auth'
import { NextRequest } from 'next/server'

// Mock environment variables
const originalEnv = process.env

describe('internal-auth', () => {
  describe('verifyInternalAuth', () => {
    beforeEach(() => {
      process.env = { ...originalEnv, INTERNAL_API_KEY: 'test-api-key-12345' }
    })

    afterEach(() => {
      process.env = originalEnv
    })

    it('should reject request without Authorization header', () => {
      const request = new NextRequest('http://localhost/api/internal/v1/articles', {
        method: 'POST',
      })

      const result = verifyInternalAuth(request)
      expect(result).toBe(false)
    })

    it('should reject request with wrong API key', () => {
      const request = new NextRequest('http://localhost/api/internal/v1/articles', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer wrong-key',
        },
      })

      const result = verifyInternalAuth(request)
      expect(result).toBe(false)
    })

    it('should reject request with malformed Authorization header', () => {
      const request = new NextRequest('http://localhost/api/internal/v1/articles', {
        method: 'POST',
        headers: {
          Authorization: 'Basic test-api-key-12345',
        },
      })

      const result = verifyInternalAuth(request)
      expect(result).toBe(false)
    })

    it('should accept request with correct API key', () => {
      const request = new NextRequest('http://localhost/api/internal/v1/articles', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key-12345',
        },
      })

      const result = verifyInternalAuth(request)
      expect(result).toBe(true)
    })

    it('should reject when INTERNAL_API_KEY is not configured', () => {
      delete process.env.INTERNAL_API_KEY

      const request = new NextRequest('http://localhost/api/internal/v1/articles', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer test-api-key-12345',
        },
      })

      const result = verifyInternalAuth(request)
      expect(result).toBe(false)
    })
  })
})