/**
 * 管理后台认证 API 集成测试
 * 测试 POST /api/admin/auth/login
 * 测试 GET /api/admin/auth/me
 * 测试 POST /api/admin/auth/logout
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as Login } from '@/app/api/admin/auth/login/route'
import { GET as Me } from '@/app/api/admin/auth/me/route'
import { POST as Logout } from '@/app/api/admin/auth/logout/route'
import prisma from '@/core/db/client'
import bcrypt from 'bcryptjs'

describe('Admin Auth API Integration', () => {
  const testEmail = `test-admin-${Date.now()}@example.com`
  const testPassword = 'TestPassword123!'
  const createdAdminIds: string[] = []
  const createdSessionIds: string[] = []

  beforeAll(async () => {
    await prisma.$connect()

    // 创建测试管理员
    const passwordHash = await bcrypt.hash(testPassword, 10)
    const admin = await prisma.admin.create({
      data: {
        email: testEmail,
        passwordHash,
        name: 'Test Admin',
        role: 'admin',
        status: 'active',
      },
    })
    createdAdminIds.push(admin.id)
  })

  afterAll(async () => {
    // 清理测试数据
    if (createdSessionIds.length > 0) {
      await prisma.session.deleteMany({
        where: { id: { in: createdSessionIds } },
      })
    }
    if (createdAdminIds.length > 0) {
      await prisma.auditLog.deleteMany({
        where: { adminId: { in: createdAdminIds } },
      })
      await prisma.session.deleteMany({
        where: { adminId: { in: createdAdminIds } },
      })
      await prisma.admin.deleteMany({
        where: { id: { in: createdAdminIds } },
      })
    }
    await prisma.$disconnect()
  })

  // ============================================
  // POST /api/admin/auth/login 测试
  // ============================================
  describe('POST /api/admin/auth/login', () => {
    it('应该成功登录', async () => {
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

      const response = await Login(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.email).toBe(testEmail)
      expect(data.data.name).toBe('Test Admin')

      // 检查 cookie 是否设置
      const setCookie = response.headers.get('set-cookie')
      expect(setCookie).toContain('admin_session=')

      // 从 cookie 中提取 session token
      const match = setCookie?.match(/admin_session=([^;]+)/)
      if (match) {
        const session = await prisma.session.findFirst({
          where: { token: match[1] },
        })
        if (session) {
          createdSessionIds.push(session.id)
        }
      }
    })

    it('错误密码应该返回 401', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          password: 'WrongPassword123',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await Login(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('不存在的邮箱应该返回 401', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await Login(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('缺少必填字段应该返回 400', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: testEmail,
          // 缺少 password
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await Login(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('无效邮箱格式应该返回 400', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'TestPassword123!',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await Login(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  // ============================================
  // GET /api/admin/auth/me 测试
  // ============================================
  describe('GET /api/admin/auth/me', () => {
    let sessionToken: string

    beforeAll(async () => {
      // 先登录获取 session token
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

      const response = await Login(request)
      const setCookie = response.headers.get('set-cookie')
      const match = setCookie?.match(/admin_session=([^;]+)/)
      sessionToken = match?.[1] || ''

      const session = await prisma.session.findFirst({
        where: { token: sessionToken },
      })
      if (session) {
        createdSessionIds.push(session.id)
      }
    })

    it('应该返回当前用户信息', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/auth/me', {
        headers: {
          Cookie: `admin_session=${sessionToken}`,
        },
      })

      const response = await Me(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.email).toBe(testEmail)
    })

    it('无 token 应该返回 401', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/auth/me')

      const response = await Me(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('无效 token 应该返回 401', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/auth/me', {
        headers: {
          Cookie: 'session_token=invalid-token',
        },
      })

      const response = await Me(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })
  })

  // ============================================
  // POST /api/admin/auth/logout 测试
  // ============================================
  describe('POST /api/admin/auth/logout', () => {
    let sessionToken: string

    beforeEach(async () => {
      // 先登录获取 session token
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

      const response = await Login(request)
      const setCookie = response.headers.get('set-cookie')
      const match = setCookie?.match(/admin_session=([^;]+)/)
      sessionToken = match?.[1] || ''
    })

    it('应该成功登出并重定向', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: `admin_session=${sessionToken}`,
        },
      })

      const response = await Logout(request)

      // 登出 API 返回重定向
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/admin/login')

      // 验证 session 已删除
      const session = await prisma.session.findFirst({
        where: { token: sessionToken },
      })
      expect(session).toBeNull()
    })

    it('无 token 也应该返回重定向', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/auth/logout', {
        method: 'POST',
      })

      const response = await Logout(request)

      // 登出 API 返回重定向
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toContain('/admin/login')
    })
  })
})