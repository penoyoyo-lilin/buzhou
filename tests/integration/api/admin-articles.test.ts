/**
 * Admin 文章 API 集成测试
 * 测试管理后台文章管理接口
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/admin/articles/route'
import { GET as GetArticle, PUT, DELETE } from '@/app/api/admin/articles/[id]/route'
import { POST as FeatureArticle } from '@/app/api/admin/articles/[id]/feature/route'
import { POST as DeprecateArticle } from '@/app/api/admin/articles/[id]/deprecate/route'
import prisma from '@/core/db/client'

// Mock 环境变量
vi.stubEnv('INTERNAL_API_KEY', 'test-internal-api-key')

describe('Admin Articles API Integration', () => {
  const createdArticleIds: string[] = []
  let testArticleId: string

  beforeAll(async () => {
    await prisma.$connect()

    // 创建一个测试文章用于查询、更新、删除测试
    const article = await prisma.article.create({
      data: {
        id: `art_test_${Date.now()}`,
        slug: `test-article-${Date.now()}`,
        title: JSON.stringify({ zh: '集成测试文章', en: 'Integration Test Article' }),
        summary: JSON.stringify({ zh: '测试摘要', en: 'Test Summary' }),
        content: JSON.stringify({ zh: '测试内容', en: 'Test Content' }),
        domain: 'agent',
        tags: JSON.stringify(['test', 'integration']),
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
        createdBy: 'admin',
      },
    })
    testArticleId = article.id
    createdArticleIds.push(article.id)
  })

  afterAll(async () => {
    // 清理测试数据
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
  // GET /api/admin/articles 列表查询测试
  // ============================================
  describe('GET /api/admin/articles', () => {
    it('should return articles list with pagination', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles?page=1&pageSize=10')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.items).toBeDefined()
      expect(Array.isArray(data.data.items)).toBe(true)
      expect(data.data.pagination).toBeDefined()
      expect(data.data.pagination.page).toBe(1)
      expect(data.data.pagination.pageSize).toBe(10)
    })

    it('should filter articles by status', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles?status=draft')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // 所有返回的文章状态应该是 draft
      data.data.items.forEach((article: { status: string }) => {
        expect(article.status).toBe('draft')
      })
    })

    it('should filter articles by domain', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles?domain=agent')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // 所有返回的文章领域应该是 agent
      data.data.items.forEach((article: { domain: string }) => {
        expect(article.domain).toBe('agent')
      })
    })

    it('should filter articles by verification status', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles?verificationStatus=pending')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      data.data.items.forEach((article: { verificationStatus: string }) => {
        expect(article.verificationStatus).toBe('pending')
      })
    })

    it('should search articles by ID or slug', async () => {
      const request = new NextRequest(`http://localhost:3000/api/admin/articles?search=${testArticleId}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.items.length).toBeGreaterThan(0)
    })

    it('should sort articles by createdAt descending by default', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles?sortBy=createdAt&sortOrder=desc')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // 验证排序顺序
      const items = data.data.items
      if (items.length > 1) {
        const firstDate = new Date(items[0].createdAt)
        const secondDate = new Date(items[1].createdAt)
        expect(firstDate >= secondDate).toBe(true)
      }
    })

    it('should validate pagination parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles?page=0')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should limit pageSize to 100', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles?pageSize=200')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  // ============================================
  // POST /api/admin/articles 创建文章测试
  // ============================================
  describe('POST /api/admin/articles', () => {
    it('should create article successfully', async () => {
      const timestamp = Date.now()
      const request = new NextRequest('http://localhost:3000/api/admin/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: { zh: `测试文章 ${timestamp}`, en: `Test Article ${timestamp}` },
          summary: { zh: '测试摘要', en: 'Test Summary' },
          content: { zh: '测试内容', en: 'Test Content' },
          domain: 'agent',
          tags: ['test'],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toMatch(/^art_/)
      expect(data.data.domain).toBe('agent')

      createdArticleIds.push(data.data.id)
    })

    it('should create article with status published', async () => {
      const timestamp = Date.now()
      const request = new NextRequest('http://localhost:3000/api/admin/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: { zh: `发布文章 ${timestamp}`, en: `Published Article ${timestamp}` },
          summary: { zh: '测试摘要', en: 'Test Summary' },
          content: { zh: '测试内容', en: 'Test Content' },
          domain: 'mcp',
          status: 'published',
          tags: ['test'],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // 验证发布状态
      const article = await prisma.article.findUnique({
        where: { id: data.data.id },
      })
      expect(article?.status).toBe('published')
      expect(article?.publishedAt).not.toBeNull()

      createdArticleIds.push(data.data.id)
    })

    it('should reject invalid domain', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: { zh: '测试', en: 'Test' },
          summary: { zh: '摘要', en: 'Summary' },
          content: { zh: '内容', en: 'Content' },
          domain: 'invalid-domain',
          tags: [],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should reject missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: { zh: '测试', en: 'Test' },
          // 缺少 summary, content, domain
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should reject empty title', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: { zh: '', en: '' },
          summary: { zh: '摘要', en: 'Summary' },
          content: { zh: '内容', en: 'Content' },
          domain: 'agent',
          tags: [],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should reject missing language in localized string', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: { zh: '只有中文' }, // 缺少 en
          summary: { zh: '摘要', en: 'Summary' },
          content: { zh: '内容', en: 'Content' },
          domain: 'agent',
          tags: [],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  // ============================================
  // GET /api/admin/articles/[id] 详情查询测试
  // ============================================
  describe('GET /api/admin/articles/[id]', () => {
    it('should return article details', async () => {
      const request = new NextRequest(`http://localhost:3000/api/admin/articles/${testArticleId}`)

      const response = await GetArticle(request, { params: { id: testArticleId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBe(testArticleId)
      expect(data.data.title).toEqual({ zh: '集成测试文章', en: 'Integration Test Article' })
      expect(data.data.tags).toEqual(['test', 'integration'])
    })

    it('should return 404 for non-existent article', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles/art_nonexistent')

      const response = await GetArticle(request, { params: { id: 'art_nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('should include verification records', async () => {
      const request = new NextRequest(`http://localhost:3000/api/admin/articles/${testArticleId}`)

      const response = await GetArticle(request, { params: { id: testArticleId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.verificationRecords).toBeDefined()
      expect(Array.isArray(data.data.verificationRecords)).toBe(true)
    })
  })

  // ============================================
  // PUT /api/admin/articles/[id] 更新文章测试
  // ============================================
  describe('PUT /api/admin/articles/[id]', () => {
    it('should update article successfully', async () => {
      const request = new NextRequest(`http://localhost:3000/api/admin/articles/${testArticleId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: { zh: '更新的标题', en: 'Updated Title' },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await PUT(request, { params: { id: testArticleId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // 验证更新
      const article = await prisma.article.findUnique({
        where: { id: testArticleId },
      })
      expect(JSON.parse(article?.title as string)).toEqual({ zh: '更新的标题', en: 'Updated Title' })
    })

    it('should update multiple fields', async () => {
      const request = new NextRequest(`http://localhost:3000/api/admin/articles/${testArticleId}`, {
        method: 'PUT',
        body: JSON.stringify({
          summary: { zh: '新摘要', en: 'New Summary' },
          tags: ['new-tag-1', 'new-tag-2'],
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await PUT(request, { params: { id: testArticleId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should update status to published', async () => {
      const request = new NextRequest(`http://localhost:3000/api/admin/articles/${testArticleId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'published',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await PUT(request, { params: { id: testArticleId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // 验证状态更新
      const article = await prisma.article.findUnique({
        where: { id: testArticleId },
      })
      expect(article?.status).toBe('published')
    })

    it('should return 404 for non-existent article', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles/art_nonexistent', {
        method: 'PUT',
        body: JSON.stringify({
          title: { zh: '测试', en: 'Test' },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await PUT(request, { params: { id: 'art_nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })
  })

  // ============================================
  // DELETE /api/admin/articles/[id] 删除文章测试
  // ============================================
  describe('DELETE /api/admin/articles/[id]', () => {
    let deleteTestArticleId: string

    beforeAll(async () => {
      // 创建专门用于删除测试的文章
      const article = await prisma.article.create({
        data: {
          id: `art_delete_${Date.now()}`,
          slug: `delete-test-${Date.now()}`,
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
          createdBy: 'admin',
        },
      })
      deleteTestArticleId = article.id
    })

    it('should delete article successfully', async () => {
      const request = new NextRequest(`http://localhost:3000/api/admin/articles/${deleteTestArticleId}`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { id: deleteTestArticleId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)

      // 验证删除
      const article = await prisma.article.findUnique({
        where: { id: deleteTestArticleId },
      })
      expect(article).toBeNull()
    })

    it('should return 404 for non-existent article', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles/art_nonexistent', {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { id: 'art_nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })
  })

  // ============================================
  // POST /api/admin/articles/[id]/feature 置顶测试
  // ============================================
  describe('POST /api/admin/articles/[id]/feature', () => {
    let featureTestArticleId: string

    beforeAll(async () => {
      const article = await prisma.article.create({
        data: {
          id: `art_feature_${Date.now()}`,
          slug: `feature-test-${Date.now()}`,
          title: JSON.stringify({ zh: '置顶测试', en: 'Feature Test' }),
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
          status: 'published',
          createdBy: 'admin',
        },
      })
      featureTestArticleId = article.id
      createdArticleIds.push(featureTestArticleId)
    })

    it('should feature article successfully', async () => {
      const request = new NextRequest(`http://localhost:3000/api/admin/articles/${featureTestArticleId}/feature`, {
        method: 'POST',
        body: JSON.stringify({ featured: true }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await FeatureArticle(request, { params: { id: featureTestArticleId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.featured).toBe(true)
      expect(data.data.featuredAt).toBeDefined()

      // 验证数据库
      const article = await prisma.article.findUnique({
        where: { id: featureTestArticleId },
      })
      expect(article?.featuredAt).not.toBeNull()
    })

    it('should unfeature article', async () => {
      const request = new NextRequest(`http://localhost:3000/api/admin/articles/${featureTestArticleId}/feature`, {
        method: 'POST',
        body: JSON.stringify({ featured: false }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await FeatureArticle(request, { params: { id: featureTestArticleId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.featured).toBe(false)

      // 验证数据库
      const article = await prisma.article.findUnique({
        where: { id: featureTestArticleId },
      })
      expect(article?.featuredAt).toBeNull()
    })

    it('should return 404 for non-existent article', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles/art_nonexistent/feature', {
        method: 'POST',
        body: JSON.stringify({ featured: true }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await FeatureArticle(request, { params: { id: 'art_nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })
  })

  // ============================================
  // POST /api/admin/articles/[id]/deprecate 标记失效测试
  // ============================================
  describe('POST /api/admin/articles/[id]/deprecate', () => {
    let deprecateTestArticleId: string

    beforeAll(async () => {
      const article = await prisma.article.create({
        data: {
          id: `art_deprecate_${Date.now()}`,
          slug: `deprecate-test-${Date.now()}`,
          title: JSON.stringify({ zh: '失效测试', en: 'Deprecate Test' }),
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
          status: 'published',
          createdBy: 'admin',
        },
      })
      deprecateTestArticleId = article.id
      createdArticleIds.push(deprecateTestArticleId)
    })

    it('should deprecate article successfully', async () => {
      const request = new NextRequest(`http://localhost:3000/api/admin/articles/${deprecateTestArticleId}/deprecate`, {
        method: 'POST',
        body: JSON.stringify({ reason: '内容已过时' }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await DeprecateArticle(request, { params: { id: deprecateTestArticleId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.status).toBe('deprecated')
      expect(data.data.deprecatedReason).toBe('内容已过时')

      // 验证数据库
      const article = await prisma.article.findUnique({
        where: { id: deprecateTestArticleId },
      })
      expect(article?.status).toBe('deprecated')
      expect(article?.deprecatedReason).toBe('内容已过时')
      expect(article?.deprecatedAt).not.toBeNull()
    })

    it('should return 404 for non-existent article', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/articles/art_nonexistent/deprecate', {
        method: 'POST',
        body: JSON.stringify({ reason: '测试' }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await DeprecateArticle(request, { params: { id: 'art_nonexistent' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
    })
  })
})