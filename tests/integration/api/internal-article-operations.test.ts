/**
 * 内部 API 文章操作集成测试
 * 测试 GET/PUT/DELETE /api/internal/v1/articles/[id]
 * 测试 POST /api/internal/v1/articles/[id]/publish
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from '@/app/api/internal/v1/articles/[id]/route'
import { POST as PublishArticle } from '@/app/api/internal/v1/articles/[id]/publish/route'
import prisma from '@/core/db/client'

// Mock 环境变量
const TEST_API_KEY = 'test-internal-api-key-12345'
vi.stubEnv('INTERNAL_API_KEY', TEST_API_KEY)

describe('Internal Article Operations API Integration', () => {
  const createdArticleIds: string[] = []
  let testArticleId: string

  beforeAll(async () => {
    await prisma.$connect()

    // 创建测试文章
    const timestamp = Date.now()
    const article = await prisma.article.create({
      data: {
        id: `art_ops_${timestamp}`,
        slug: `test-ops-article-${timestamp}`,
        title: JSON.stringify({ zh: '操作测试文章', en: 'Operations Test Article' }),
        summary: JSON.stringify({ zh: '测试摘要', en: 'Test Summary' }),
        content: JSON.stringify({ zh: '测试内容', en: 'Test Content' }),
        domain: 'agent',
        tags: JSON.stringify(['test', 'operations']),
        keywords: JSON.stringify(['test']),
        codeBlocks: JSON.stringify([]),
        metadata: JSON.stringify({
          applicableVersions: [],
          confidenceScore: 0,
          riskLevel: 'low',
          runtimeEnv: [],
        }),
        qaPairs: JSON.stringify([]),
        relatedIds: JSON.stringify([]),
        verificationStatus: 'pending',
        status: 'draft',
        createdBy: 'test',
      },
    })
    testArticleId = article.id
    createdArticleIds.push(article.id)
  })

  afterAll(async () => {
    if (createdArticleIds.length > 0) {
      await prisma.verificationRecord.deleteMany({
        where: { articleId: { in: createdArticleIds } },
      })
      await prisma.article.deleteMany({
        where: { id: { in: createdArticleIds } },
      })
    }
    await prisma.$disconnect()
  })

  // ============================================
  // GET /api/internal/v1/articles/[id] 测试
  // ============================================
  describe('GET - 获取文章详情', () => {
    it('应该返回文章详情', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/internal/v1/articles/${testArticleId}`,
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request, { params: Promise.resolve({ id: testArticleId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(testArticleId)
      expect(data.data.title).toEqual({ zh: '操作测试文章', en: 'Operations Test Article' })
      expect(data.data.domain).toBe('agent')
    })

    it('无认证应该返回 401', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/internal/v1/articles/${testArticleId}`
      )

      const response = await GET(request, { params: Promise.resolve({ id: testArticleId }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('无效 API Key 应该返回 401', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/internal/v1/articles/${testArticleId}`,
        {
          headers: {
            Authorization: 'Bearer invalid-key',
          },
        }
      )

      const response = await GET(request, { params: Promise.resolve({ id: testArticleId }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })

    it('不存在的文章应该返回 404', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/articles/art_nonexistent',
        {
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await GET(request, { params: Promise.resolve({ id: 'art_nonexistent' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })
  })

  // ============================================
  // PUT /api/internal/v1/articles/[id] 测试
  // ============================================
  describe('PUT - 更新文章', () => {
    it('应该更新文章标题', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/internal/v1/articles/${testArticleId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            title: { zh: '更新后的标题', en: 'Updated Title' },
          }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await PUT(request, { params: Promise.resolve({ id: testArticleId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.title).toEqual({ zh: '更新后的标题', en: 'Updated Title' })
    })

    it('应该更新多个字段', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/internal/v1/articles/${testArticleId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            summary: { zh: '新摘要', en: 'New Summary' },
            tags: ['new-tag-1', 'new-tag-2'],
            content: { zh: '新内容', en: 'New Content' },
          }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await PUT(request, { params: Promise.resolve({ id: testArticleId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.summary).toEqual({ zh: '新摘要', en: 'New Summary' })
      expect(data.data.tags).toEqual(['new-tag-1', 'new-tag-2'])
    })

    it('无效数据应该返回验证错误', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/internal/v1/articles/${testArticleId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            title: { zh: '' }, // 缺少 en 且 zh 为空
          }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await PUT(request, { params: Promise.resolve({ id: testArticleId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('无认证应该返回 401', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/internal/v1/articles/${testArticleId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ title: { zh: '测试', en: 'Test' } }),
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      const response = await PUT(request, { params: Promise.resolve({ id: testArticleId }) })
      const data = await response.json()

      expect(response.status).toBe(401)
    })

    it('不存在的文章应该返回 404', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/articles/art_nonexistent',
        {
          method: 'PUT',
          body: JSON.stringify({
            title: { zh: '测试', en: 'Test' },
          }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await PUT(request, { params: Promise.resolve({ id: 'art_nonexistent' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
    })
  })

  // ============================================
  // DELETE /api/internal/v1/articles/[id] 测试
  // ============================================
  describe('DELETE - 删除文章', () => {
    let deleteTestArticleId: string

    beforeAll(async () => {
      const timestamp = Date.now()
      const article = await prisma.article.create({
        data: {
          id: `art_delete_test_${timestamp}`,
          slug: `delete-test-${timestamp}`,
          title: JSON.stringify({ zh: '删除测试', en: 'Delete Test' }),
          summary: JSON.stringify({ zh: '摘要', en: 'Summary' }),
          content: JSON.stringify({ zh: '内容', en: 'Content' }),
          domain: 'agent',
          tags: JSON.stringify([]),
          keywords: JSON.stringify([]),
          codeBlocks: JSON.stringify([]),
          metadata: JSON.stringify({
            applicableVersions: [],
            confidenceScore: 0,
            riskLevel: 'low',
            runtimeEnv: [],
          }),
          qaPairs: JSON.stringify([]),
          relatedIds: JSON.stringify([]),
          verificationStatus: 'pending',
          status: 'draft',
          createdBy: 'test',
        },
      })
      deleteTestArticleId = article.id
    })

    it('应该删除文章', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/internal/v1/articles/${deleteTestArticleId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await DELETE(request, { params: Promise.resolve({ id: deleteTestArticleId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.deleted).toBe(true)

      // 验证删除
      const article = await prisma.article.findUnique({
        where: { id: deleteTestArticleId },
      })
      expect(article).toBeNull()
    })

    it('无认证应该返回 401', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/internal/v1/articles/${testArticleId}`,
        {
          method: 'DELETE',
        }
      )

      const response = await DELETE(request, { params: Promise.resolve({ id: testArticleId }) })
      const data = await response.json()

      expect(response.status).toBe(401)
    })

    it('不存在的文章应该返回 404', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/articles/art_nonexistent',
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await DELETE(request, { params: Promise.resolve({ id: 'art_nonexistent' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
    })
  })

  // ============================================
  // POST /api/internal/v1/articles/[id]/publish 测试
  // ============================================
  describe('POST - 发布文章', () => {
    let publishTestArticleId: string

    beforeAll(async () => {
      const timestamp = Date.now()
      const article = await prisma.article.create({
        data: {
          id: `art_publish_test_${timestamp}`,
          slug: `publish-test-${timestamp}`,
          title: JSON.stringify({ zh: '发布测试', en: 'Publish Test' }),
          summary: JSON.stringify({ zh: '摘要', en: 'Summary' }),
          content: JSON.stringify({ zh: '内容', en: 'Content' }),
          domain: 'agent',
          tags: JSON.stringify([]),
          keywords: JSON.stringify([]),
          codeBlocks: JSON.stringify([]),
          metadata: JSON.stringify({
            applicableVersions: [],
            confidenceScore: 0,
            riskLevel: 'low',
            runtimeEnv: [],
          }),
          qaPairs: JSON.stringify([]),
          relatedIds: JSON.stringify([]),
          verificationStatus: 'pending',
          status: 'draft',
          createdBy: 'test',
        },
      })
      publishTestArticleId = article.id
      createdArticleIds.push(publishTestArticleId)
    })

    it('应该发布文章', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/internal/v1/articles/${publishTestArticleId}/publish`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await PublishArticle(request, { params: Promise.resolve({ id: publishTestArticleId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('published')
      expect(data.data.publishedAt).toBeDefined()

      // 验证数据库
      const article = await prisma.article.findUnique({
        where: { id: publishTestArticleId },
      })
      expect(article?.status).toBe('published')
      expect(article?.publishedAt).not.toBeNull()
    })

    it('已发布的文章再次发布应该返回错误', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/internal/v1/articles/${publishTestArticleId}/publish`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await PublishArticle(request, { params: Promise.resolve({ id: publishTestArticleId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('无认证应该返回 401', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/internal/v1/articles/${publishTestArticleId}/publish`,
        {
          method: 'POST',
        }
      )

      const response = await PublishArticle(request, { params: Promise.resolve({ id: publishTestArticleId }) })
      const data = await response.json()

      expect(response.status).toBe(401)
    })

    it('不存在的文章应该返回 404', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/internal/v1/articles/art_nonexistent/publish',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${TEST_API_KEY}`,
          },
        }
      )

      const response = await PublishArticle(request, { params: Promise.resolve({ id: 'art_nonexistent' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
    })
  })
})