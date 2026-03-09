/**
 * 文章详情 API 集成测试
 * 测试 GET /api/v1/articles/[slug]
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/v1/articles/[slug]/route'
import prisma from '@/core/db/client'

describe('Article Detail API Integration', () => {
  const testArticleIds: string[] = []
  let testArticleSlug: string

  beforeAll(async () => {
    await prisma.$connect()

    const timestamp = Date.now()
    testArticleSlug = `test-article-detail-${timestamp}`

    const article = await prisma.article.create({
      data: {
        id: `art_detail_${timestamp}`,
        slug: testArticleSlug,
        title: JSON.stringify({ zh: '测试文章详情', en: 'Test Article Detail' }),
        summary: JSON.stringify({ zh: '这是一篇测试文章', en: 'This is a test article' }),
        content: JSON.stringify({
          zh: '## 测试内容\n\n这是测试内容。',
          en: '## Test Content\n\nThis is test content.',
        }),
        domain: 'agent',
        tags: JSON.stringify(['test', 'article']),
        keywords: JSON.stringify(['test', 'detail']),
        codeBlocks: JSON.stringify([
          {
            id: 'code_1',
            language: 'typescript',
            filename: 'test.ts',
            content: 'console.log("Hello")',
            description: { zh: '测试代码', en: 'Test code' },
          },
        ]),
        metadata: JSON.stringify({
          applicableVersions: ['1.0.0'],
          confidenceScore: 90,
          riskLevel: 'low',
          runtimeEnv: [{ name: 'Node.js', version: '18+' }],
        }),
        qaPairs: JSON.stringify([
          {
            id: 'qa_1',
            question: { zh: '这是什么？', en: 'What is this?' },
            answer: { zh: '这是一个测试。', en: 'This is a test.' },
          },
        ]),
        relatedIds: JSON.stringify([]),
        verificationStatus: 'verified',
        status: 'published',
        publishedAt: new Date(),
        createdBy: 'test',
      },
    })

    testArticleIds.push(article.id)
  })

  afterAll(async () => {
    if (testArticleIds.length > 0) {
      await prisma.verificationRecord.deleteMany({
        where: { articleId: { in: testArticleIds } },
      })
      await prisma.article.deleteMany({
        where: { id: { in: testArticleIds } },
      })
    }
    await prisma.$disconnect()
  })

  // ============================================
  // 默认格式测试
  // ============================================
  describe('默认格式', () => {
    it('应该返回文章摘要信息', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.id).toBeDefined()
      expect(data.data.slug).toBe(testArticleSlug)
      expect(data.data.title).toEqual({ zh: '测试文章详情', en: 'Test Article Detail' })
      expect(data.data.summary).toEqual({ zh: '这是一篇测试文章', en: 'This is a test article' })
      expect(data.data.domain).toBe('agent')
    })

    it('应该返回格式链接', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.formats).toBeDefined()
      expect(data.data.formats.json).toContain('format=json')
      expect(data.data.formats.markdown).toContain('format=markdown')
    })

    it('应该返回验证状态和置信度', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.verificationStatus).toBe('verified')
      expect(data.data.confidenceScore).toBe(90)
      expect(data.data.riskLevel).toBe('low')
    })

    it('应该返回标签和关键词', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.tags).toEqual(['test', 'article'])
      expect(data.data.keywords).toEqual(['test', 'detail'])
    })

    it('应该返回时间信息', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.publishedAt).toBeDefined()
      expect(data.data.updatedAt).toBeDefined()
      expect(data.data.createdAt).toBeDefined()
    })
  })

  // ============================================
  // JSON 格式测试
  // ============================================
  describe('JSON 格式', () => {
    it('应该返回 JSON 格式内容', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}?format=json`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const contentType = response.headers.get('Content-Type')

      expect(contentType).toContain('application/json')

      const text = await response.text()
      const data = JSON.parse(text)

      expect(data.id).toBeDefined()
      expect(data.title).toBe('测试文章详情')
      expect(data.content).toBeDefined()
    })

    it('应该支持语言参数', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}?format=json&lang=en`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const text = await response.text()
      const data = JSON.parse(text)

      expect(data.lang).toBe('en')
      expect(data.title).toBe('Test Article Detail')
    })

    it('应该包含代码块', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}?format=json`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const text = await response.text()
      const data = JSON.parse(text)

      expect(data.codeBlocks).toBeDefined()
      expect(data.codeBlocks.length).toBeGreaterThan(0)
      expect(data.codeBlocks[0].language).toBe('typescript')
      expect(data.codeBlocks[0].content).toBe('console.log("Hello")')
    })

    it('应该包含 QA 对', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}?format=json`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const text = await response.text()
      const data = JSON.parse(text)

      expect(data.qaPairs).toBeDefined()
      expect(data.qaPairs.length).toBeGreaterThan(0)
    })

    it('应该包含 API 接入引导', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}?format=json`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const text = await response.text()
      const data = JSON.parse(text)

      expect(data.apiAccess).toBeDefined()
      expect(data.apiAccess.endpoints).toBeDefined()
      expect(data.apiAccess.endpoints.search).toBeDefined()
      expect(data.apiAccess.endpoints.json).toBeDefined()
      expect(data.apiAccess.endpoints.markdown).toBeDefined()
    })
  })

  // ============================================
  // Markdown 格式测试
  // ============================================
  describe('Markdown 格式', () => {
    it('应该返回 Markdown 格式内容', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}?format=markdown`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const contentType = response.headers.get('Content-Type')

      expect(contentType).toContain('text/markdown')

      const text = await response.text()

      expect(text).toContain('# 测试文章详情')
      expect(text).toContain('> 这是一篇测试文章')
    })

    it('应该支持英文内容', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}?format=markdown&lang=en`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const text = await response.text()

      expect(text).toContain('# Test Article Detail')
      expect(text).toContain('> This is a test article')
    })

    it('应该包含代码块', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}?format=markdown`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const text = await response.text()

      expect(text).toContain('```typescript')
      expect(text).toContain('console.log')
    })

    it('应该包含 QA 部分', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}?format=markdown`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const text = await response.text()

      expect(text).toContain('## Q&A')
      expect(text).toContain('Q:')
    })

    it('应该包含元数据', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}?format=markdown`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const text = await response.text()

      expect(text).toContain('## Metadata')
      expect(text).toContain('**Domain:** agent')
      expect(text).toContain('**Verification Status:** verified')
      expect(text).toContain('**Confidence Score:** 90%')
    })

    it('应该包含 API 接入引导', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}?format=markdown`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const text = await response.text()

      expect(text).toContain('## API Access')
      expect(text).toContain('curl')
    })
  })

  // ============================================
  // 错误处理测试
  // ============================================
  describe('错误处理', () => {
    it('不存在的文章应该返回 404', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/v1/articles/non-existent-article'
      )

      const response = await GET(request, { params: { slug: 'non-existent-article' } })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('NOT_FOUND')
    })

    it('无效格式参数应该返回默认格式', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}?format=invalid`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })

      // 应该返回默认的 JSON API 响应
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
    })
  })

  // ============================================
  // 响应头测试
  // ============================================
  describe('响应头', () => {
    it('应该返回 X-Agent-API-Endpoint 头', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })

      expect(response.headers.get('X-Agent-API-Endpoint')).toContain('/api/v1/articles/')
    })

    it('JSON 格式应该返回 X-Article-Id 头', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}?format=json`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })

      expect(response.headers.get('X-Article-Id')).toBeDefined()
      expect(response.headers.get('X-Article-Slug')).toBe(testArticleSlug)
    })

    it('Markdown 格式应该返回正确的 Content-Type', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/v1/articles/${testArticleSlug}?format=markdown`
      )

      const response = await GET(request, { params: { slug: testArticleSlug } })
      const contentType = response.headers.get('Content-Type')

      expect(contentType).toContain('text/markdown')
      expect(contentType).toContain('charset=utf-8')
    })
  })
})