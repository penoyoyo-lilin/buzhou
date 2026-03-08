/**
 * 管理后台认证集成测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as loginPOST } from '@/app/api/admin/auth/login/route'
import { POST as logoutPOST } from '@/app/api/admin/auth/logout/route'
import { GET as meGET } from '@/app/api/admin/auth/me/route'
import prisma from '@/core/db/client'
import bcrypt from 'bcryptjs'

describe('Admin Auth Integration', () => {
  const testEmail = 'test-admin@buzhou.ai'
  const testPassword = 'test123456'

  beforeAll(async () => {
    // 创建测试管理员
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: testEmail },
    })

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(testPassword, 10)
      await prisma.admin.create({
        data: {
          email: testEmail,
          passwordHash,
          name: 'Test Admin',
          role: 'admin',
          status: 'active',
        },
      })
    }
  })

  afterAll(async () => {
    // 清理测试数据（需要按顺序删除，避免外键约束错误）
    // 1. 先删除 session
    await prisma.session.deleteMany({
      where: {
        admin: {
          email: testEmail,
        },
      },
    })
    // 2. 删除 audit_logs
    await prisma.auditLog.deleteMany({
      where: {
        admin: {
          email: testEmail,
        },
      },
    })
    // 3. 最后删除 admin
    await prisma.admin.deleteMany({
      where: { email: testEmail },
    })
    await prisma.$disconnect()
  })

  describe('POST /api/admin/auth/login', () => {
    it('should login with valid credentials', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await loginPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // API 直接返回 admin 对象在 data 中
      expect(data.data).toBeDefined()
      expect(data.data.email).toBe(testEmail)
    })

    it('should reject invalid credentials', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          password: 'wrongpassword',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await loginPOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('should reject non-existent user', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'nonexistent@buzhou.ai',
          password: 'anypassword',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await loginPOST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })
  })

  describe('GET /api/admin/auth/me', () => {
    it('should return 401 without session', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/auth/me')

      const response = await meGET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })
  })
})