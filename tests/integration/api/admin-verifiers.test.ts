/**
 * 管理后台验证人 API 集成测试
 * 测试 GET/POST /api/admin/verifiers
 * 测试 GET/PUT/DELETE /api/admin/verifiers/[id]
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as ListVerifiers, POST as CreateVerifier } from '@/app/api/admin/verifiers/route'
import { GET as GetVerifier, PUT as UpdateVerifier, DELETE as DeleteVerifier } from '@/app/api/admin/verifiers/[id]/route'
import prisma from '@/core/db/client'

describe('Admin Verifiers API Integration', () => {
  const createdVerifierIds: number[] = []
  let testVerifierId: number

  beforeAll(async () => {
    await prisma.$connect()

    // 创建测试验证人
    const verifier = await prisma.verifier.create({
      data: {
        type: 'official_bot',
        name: 'Test Verifier',
        description: 'Test verifier for integration tests',
        credentials: JSON.stringify({ verified: true }),
        reputationScore: 100,
        reputationLevel: 'expert',
        totalVerifications: 0,
        passedCount: 0,
        failedCount: 0,
        partialCount: 0,
        status: 'active',
      },
    })
    testVerifierId = verifier.id
    createdVerifierIds.push(verifier.id)
  })

  afterAll(async () => {
    if (createdVerifierIds.length > 0) {
      await prisma.verificationRecord.deleteMany({
        where: { verifierId: { in: createdVerifierIds } },
      })
      await prisma.verifier.deleteMany({
        where: { id: { in: createdVerifierIds } },
      })
    }
    await prisma.$disconnect()
  })

  // ============================================
  // GET /api/admin/verifiers 测试
  // ============================================
  describe('GET /api/admin/verifiers', () => {
    it('应该返回验证人列表', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/verifiers')

      const response = await ListVerifiers(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.items).toBeDefined()
      expect(Array.isArray(data.data.items)).toBe(true)
      expect(data.data.pagination).toBeDefined()
    })

    it('应该支持分页', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/verifiers?page=1&pageSize=10'
      )

      const response = await ListVerifiers(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.pagination.page).toBe(1)
      expect(data.data.pagination.pageSize).toBe(10)
    })

    it('应该支持类型筛选', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/verifiers?type=official_bot'
      )

      const response = await ListVerifiers(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      data.data.items.forEach((verifier: { type: string }) => {
        expect(verifier.type).toBe('official_bot')
      })
    })

    it('应该支持状态筛选', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/verifiers?status=active'
      )

      const response = await ListVerifiers(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      data.data.items.forEach((verifier: { status: string }) => {
        expect(verifier.status).toBe('active')
      })
    })
  })

  // ============================================
  // POST /api/admin/verifiers 测试
  // ============================================
  describe('POST /api/admin/verifiers', () => {
    it('应该创建验证人', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/verifiers', {
        method: 'POST',
        body: JSON.stringify({
          type: 'third_party_agent',
          name: 'New Verifier',
          description: 'New test verifier',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await CreateVerifier(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBeDefined()
      expect(data.data.name).toBe('New Verifier')

      createdVerifierIds.push(data.data.id)
    })

    it('缺少必填字段应该返回错误', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/verifiers', {
        method: 'POST',
        body: JSON.stringify({
          // 缺少 type, name
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await CreateVerifier(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  // ============================================
  // GET /api/admin/verifiers/[id] 测试
  // ============================================
  describe('GET /api/admin/verifiers/[id]', () => {
    it('应该返回验证人详情', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/admin/verifiers/${testVerifierId}`
      )

      const response = await GetVerifier(request, { params: { id: String(testVerifierId) } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(testVerifierId)
      expect(data.data.name).toBe('Test Verifier')
    })

    it('不存在的验证人应该返回 404', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/verifiers/999999'
      )

      const response = await GetVerifier(request, { params: { id: '999999' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })
  })

  // ============================================
  // PUT /api/admin/verifiers/[id] 测试
  // ============================================
  describe('PUT /api/admin/verifiers/[id]', () => {
    it('应该更新验证人', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/admin/verifiers/${testVerifierId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name: 'Updated Verifier Name',
            status: 'active',
          }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const response = await UpdateVerifier(request, { params: { id: String(testVerifierId) } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Updated Verifier Name')
    })

    it('不存在的验证人应该返回 404', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/verifiers/999999',
        {
          method: 'PUT',
          body: JSON.stringify({ name: 'Test' }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const response = await UpdateVerifier(request, { params: { id: '999999' } })
      const data = await response.json()

      expect(response.status).toBe(404)
    })
  })

  // ============================================
  // DELETE /api/admin/verifiers/[id] 测试
  // ============================================
  describe('DELETE /api/admin/verifiers/[id]', () => {
    let deleteTestVerifierId: number

    beforeAll(async () => {
      const verifier = await prisma.verifier.create({
        data: {
          type: 'human_expert',
          name: 'Delete Test Verifier',
          description: 'Verifier for delete test',
          credentials: JSON.stringify({ verified: true }),
          reputationScore: 50,
          reputationLevel: 'beginner',
          totalVerifications: 0,
          passedCount: 0,
          failedCount: 0,
          partialCount: 0,
          status: 'active',
        },
      })
      deleteTestVerifierId = verifier.id
    })

    it('应该删除验证人', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/admin/verifiers/${deleteTestVerifierId}`,
        {
          method: 'DELETE',
        }
      )

      const response = await DeleteVerifier(request, { params: { id: String(deleteTestVerifierId) } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // 验证删除
      const verifier = await prisma.verifier.findUnique({
        where: { id: deleteTestVerifierId },
      })
      expect(verifier).toBeNull()
    })

    it('不存在的验证人应该返回 404', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/admin/verifiers/999999',
        {
          method: 'DELETE',
        }
      )

      const response = await DeleteVerifier(request, { params: { id: '999999' } })
      const data = await response.json()

      expect(response.status).toBe(404)
    })
  })
})