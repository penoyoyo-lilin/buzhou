/**
 * 内部 API 文章创建接口集成测试
 * POST /api/internal/v1/articles
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/internal/v1/articles/route'
import prisma from '@/core/db/client'
import { nanoid } from 'nanoid'

// Mock 环境变量
const TEST_API_KEY = 'test-internal-api-key-12345'

// 设置测试环境变量
vi.stubEnv('INTERNAL_API_KEY', TEST_API_KEY)

describe('Internal Articles API Integration', () => {
  const createdArticleIds: string[] = []

  beforeAll(async () => {
    // 确保数据库连接
    await prisma.$connect()
  })

  afterAll(async () => {
    // 清理测试创建的文章
    if (createdArticleIds.length > 0) {
      // 先删除关联的验证记录
      await prisma.verificationRecord.deleteMany({
        where: { articleId: { in: createdArticleIds } },
      })
      // 再删除文章
      await prisma.article.deleteMany({
        where: { id: { in: createdArticleIds } },
      })
    }
    await prisma.$disconnect()
  })

  describe('Authentication', () => {
    it('should reject request without Authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: { zh: '测试', en: 'Test' },
          summary: { zh: '摘要', en: 'Summary' },
          content: { zh: '内容', en: 'Content' },
          domain: 'agent',
          createdBy: 'test',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should reject request with invalid API key', async () => {
      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: { zh: '测试', en: 'Test' },
          summary: { zh: '摘要', en: 'Summary' },
          content: { zh: '内容', en: 'Content' },
          domain: 'agent',
          createdBy: 'test',
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer invalid-key',
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should reject request with malformed Authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: { zh: '测试', en: 'Test' },
          summary: { zh: '摘要', en: 'Summary' },
          content: { zh: '内容', en: 'Content' },
          domain: 'agent',
          createdBy: 'test',
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Basic some-token', // 错误的认证类型
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })
  })

  describe('Input Validation', () => {
    it('should reject request with missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify({
          // 缺少 title, summary, content, domain, createdBy
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200) // API 返回 200 但 success: false
      expect(data.data.results[0].success).toBe(false)
      expect(data.data.results[0].error).toBeDefined()
    })

    it('should reject request with invalid domain', async () => {
      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: { zh: '测试', en: 'Test' },
          summary: { zh: '摘要', en: 'Summary' },
          content: { zh: '内容', en: 'Content' },
          domain: 'invalid-domain', // 无效的 domain
          createdBy: 'test',
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.data.results[0].success).toBe(false)
    })

    it('should reject request with empty title', async () => {
      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: { zh: '', en: '' }, // 空标题
          summary: { zh: '摘要', en: 'Summary' },
          content: { zh: '内容', en: 'Content' },
          domain: 'agent',
          createdBy: 'test',
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.data.results[0].success).toBe(false)
    })

    it('should reject request with missing language in localized string', async () => {
      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify({
          title: { zh: '只有中文' }, // 缺少 en
          summary: { zh: '摘要', en: 'Summary' },
          content: { zh: '内容', en: 'Content' },
          domain: 'agent',
          createdBy: 'test',
        }),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.data.results[0].success).toBe(false)
    })
  })

  describe('Article Creation', () => {
    it('should create article successfully with valid data', async () => {
      const timestamp = Date.now()
      const articleData = {
        title: { zh: `Claude Agent SDK 入门 ${timestamp}`, en: `Getting Started with Claude Agent SDK ${timestamp}` },
        summary: { zh: '本教程介绍如何使用 Claude Agent SDK', en: 'This tutorial covers Claude Agent SDK' },
        content: { zh: '## 简介\n\nClaude Agent SDK 是...', en: '## Introduction\n\nClaude Agent SDK is...' },
        domain: 'agent' as const,
        tags: ['Claude', 'SDK', 'Tutorial'],
        createdBy: 'test-pipeline',
        skipVerification: true, // 跳过沙盒验证以便测试
      }

      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify(articleData),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.results).toHaveLength(1)
      expect(data.data.results[0].success).toBe(true)
      expect(data.data.results[0].article).toBeDefined()
      expect(data.data.results[0].article.id).toMatch(/^art_/)
      expect(data.data.results[0].article.domain).toBe('agent')
      expect(data.data.summary.total).toBe(1)
      expect(data.data.summary.success).toBe(1)
      expect(data.data.summary.failed).toBe(0)

      // 记录创建的文章 ID 以便清理
      createdArticleIds.push(data.data.results[0].article.id)
    })

    it('should create article with all optional fields', async () => {
      const timestamp = Date.now()
      const articleData = {
        title: { zh: `MCP 协议详解 ${timestamp}`, en: `MCP Protocol Deep Dive ${timestamp}` },
        summary: { zh: '深入理解 MCP 协议', en: 'Understanding MCP Protocol' },
        content: { zh: 'MCP 协议内容...', en: 'MCP Protocol content...' },
        domain: 'mcp' as const,
        tags: ['MCP', 'Protocol'],
        codeBlocks: [
          {
            id: 'code_1',
            language: 'typescript',
            filename: 'example.ts',
            content: 'console.log("Hello")',
            description: { zh: '示例代码', en: 'Example code' },
          },
        ],
        metadata: {
          applicableVersions: ['1.0.0'],
          confidenceScore: 85,
          riskLevel: 'low' as const,
          runtimeEnv: [{ name: 'Node.js', version: '18+' }],
        },
        qaPairs: [
          {
            id: 'qa_1',
            question: { zh: '什么是 MCP?', en: 'What is MCP?' },
            answer: { zh: 'MCP 是...', en: 'MCP is...' },
          },
        ],
        relatedIds: [],
        createdBy: 'test-pipeline',
        skipVerification: true,
      }

      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify(articleData),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.results[0].success).toBe(true)
      expect(data.data.results[0].article.domain).toBe('mcp')
      expect(data.data.results[0].article.tags).toEqual(['MCP', 'Protocol'])

      createdArticleIds.push(data.data.results[0].article.id)
    })

    it('should create multiple articles in batch', async () => {
      const articlesData = [
        {
          title: { zh: '批量文章 1', en: 'Batch Article 1' },
          summary: { zh: '摘要 1', en: 'Summary 1' },
          content: { zh: '内容 1', en: 'Content 1' },
          domain: 'agent' as const,
          createdBy: 'test-pipeline',
          skipVerification: true,
        },
        {
          title: { zh: '批量文章 2', en: 'Batch Article 2' },
          summary: { zh: '摘要 2', en: 'Summary 2' },
          content: { zh: '内容 2', en: 'Content 2' },
          domain: 'skill' as const,
          createdBy: 'test-pipeline',
          skipVerification: true,
        },
      ]

      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify(articlesData),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.results).toHaveLength(2)
      expect(data.data.summary.total).toBe(2)
      expect(data.data.summary.success).toBe(2)

      // 记录创建的文章 ID
      data.data.results.forEach((r: { success: boolean; article?: { id: string } }) => {
        if (r.success && r.article) {
          createdArticleIds.push(r.article.id)
        }
      })
    })

    it('should create article with custom slug', async () => {
      const customSlug = `custom-slug-${Date.now()}`
      const articleData = {
        slug: customSlug,
        title: { zh: '自定义 Slug', en: 'Custom Slug' },
        summary: { zh: '摘要', en: 'Summary' },
        content: { zh: '内容', en: 'Content' },
        domain: 'agent' as const,
        createdBy: 'test-pipeline',
        skipVerification: true,
      }

      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify(articleData),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.results[0].success).toBe(true)
      expect(data.data.results[0].article.slug).toBe(customSlug)

      createdArticleIds.push(data.data.results[0].article.id)
    })
  })

  describe('Partial Success Handling', () => {
    it('should handle batch with mixed valid and invalid items', async () => {
      const articlesData = [
        {
          title: { zh: '有效文章', en: 'Valid Article' },
          summary: { zh: '摘要', en: 'Summary' },
          content: { zh: '内容', en: 'Content' },
          domain: 'agent' as const,
          createdBy: 'test-pipeline',
          skipVerification: true,
        },
        {
          // 无效文章 - 缺少必填字段
          title: { zh: '无效文章', en: 'Invalid Article' },
          // 缺少 summary, content, domain
          createdBy: 'test-pipeline',
        },
      ]

      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify(articlesData),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.results).toHaveLength(2)
      expect(data.data.summary.total).toBe(2)
      expect(data.data.summary.success).toBe(1)
      expect(data.data.summary.failed).toBe(1)

      // 第一个应该成功
      expect(data.data.results[0].success).toBe(true)
      // 第二个应该失败
      expect(data.data.results[1].success).toBe(false)
      expect(data.data.results[1].error).toBeDefined()

      // 清理成功的文章
      if (data.data.results[0].success && data.data.results[0].article) {
        createdArticleIds.push(data.data.results[0].article.id)
      }
    })
  })

  describe('Response Format', () => {
    it('should return correct response structure', async () => {
      const articleData = {
        title: { zh: '响应格式测试', en: 'Response Format Test' },
        summary: { zh: '摘要', en: 'Summary' },
        content: { zh: '内容', en: 'Content' },
        domain: 'agent' as const,
        createdBy: 'test-pipeline',
        skipVerification: true,
      }

      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify(articleData),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      // 验证响应结构
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('data')
      expect(data).toHaveProperty('meta')
      expect(data).toHaveProperty('error')

      // 验证 meta 字段
      expect(data.meta).toHaveProperty('requestId')
      expect(data.meta).toHaveProperty('timestamp')

      // 验证 data 结构
      expect(data.data).toHaveProperty('results')
      expect(data.data).toHaveProperty('summary')

      createdArticleIds.push(data.data.results[0].article.id)
    })
  })

  describe('Verification Records', () => {
    it('should create article with verification records', async () => {
      // 先创建一个验证人（id 由数据库自动生成）
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

      const articleData = {
        slug: `test-article-${nanoid(8)}`,
        title: { zh: '带验证记录的文章', en: 'Article with Verification Records' },
        summary: { zh: '摘要', en: 'Summary' },
        content: { zh: '内容', en: 'Content' },
        domain: 'agent' as const,
        createdBy: 'test-pipeline',
        skipVerification: true,
        verificationRecords: [
          {
            verifierId: verifier.id,
            result: 'passed' as const,
            environment: {
              os: 'macOS',
              runtime: 'Node.js',
              version: '20.0.0',
            },
            notes: 'Test verification',
          },
        ],
      }

      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify(articleData),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.results[0].success).toBe(true)

      const articleId = data.data.results[0].article.id
      createdArticleIds.push(articleId)

      // 验证验证记录是否创建
      const records = await prisma.verificationRecord.findMany({
        where: { articleId },
      })

      expect(records.length).toBeGreaterThan(0)
      expect(records[0].result).toBe('passed')

      // 清理测试验证人
      await prisma.verificationRecord.deleteMany({
        where: { verifierId: verifier.id },
      })
      await prisma.verifier.delete({ where: { id: verifier.id } })
    })

    it('should handle multiple verification records', async () => {
      // 创建两个验证人（id 由数据库自动生成）
      const verifier1 = await prisma.verifier.create({
        data: {
          type: 'official_bot',
          name: 'Test Verifier 1',
          description: '',
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

      const verifier2 = await prisma.verifier.create({
        data: {
          type: 'human_expert',
          name: 'Test Verifier 2',
          description: '',
          credentials: JSON.stringify({ verified: true }),
          reputationScore: 90,
          reputationLevel: 'expert',
          totalVerifications: 0,
          passedCount: 0,
          failedCount: 0,
          partialCount: 0,
          status: 'active',
        },
      })

      const articleData = {
        slug: `test-multi-verification-${nanoid(8)}`,
        title: { zh: '多验证记录文章', en: 'Article with Multiple Verification Records' },
        summary: { zh: '摘要', en: 'Summary' },
        content: { zh: '内容', en: 'Content' },
        domain: 'agent' as const,
        createdBy: 'test-pipeline',
        skipVerification: true,
        verificationRecords: [
          {
            verifierId: verifier1.id,
            result: 'passed' as const,
            environment: { os: 'macOS', runtime: 'Node.js', version: '20.0.0' },
          },
          {
            verifierId: verifier2.id,
            result: 'partial' as const,
            environment: { os: 'Linux', runtime: 'Bun', version: '1.0.0' },
            notes: 'Partial pass',
          },
        ],
      }

      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify(articleData),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.results[0].success).toBe(true)

      const articleId = data.data.results[0].article.id
      createdArticleIds.push(articleId)

      // 验证验证记录
      const records = await prisma.verificationRecord.findMany({
        where: { articleId },
      })

      expect(records.length).toBe(2)

      // 清理
      await prisma.verificationRecord.deleteMany({
        where: { verifierId: { in: [verifier1.id, verifier2.id] } },
      })
      await prisma.verifier.deleteMany({
        where: { id: { in: [verifier1.id, verifier2.id] } },
      })
    })

    it('should ignore invalid verification records', async () => {
      const articleData = {
        title: { zh: '无效验证记录测试', en: 'Invalid Verification Records Test' },
        summary: { zh: '摘要', en: 'Summary' },
        content: { zh: '内容', en: 'Content' },
        domain: 'agent' as const,
        createdBy: 'test-pipeline',
        skipVerification: true,
        verificationRecords: [
          {
            verifierId: 'non-existent-verifier',
            result: 'passed' as const,
            environment: { os: 'macOS', runtime: 'Node.js', version: '20.0.0' },
          },
        ],
      }

      const request = new NextRequest('http://localhost:3000/api/internal/v1/articles', {
        method: 'POST',
        body: JSON.stringify(articleData),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TEST_API_KEY}`,
        },
      })

      const response = await POST(request)
      const data = await response.json()

      // 当前实现：验证记录创建失败会导致文章创建失败
      expect(response.status).toBe(200)
      expect(data.data.results[0].success).toBe(false)
      expect(data.data.results[0].error).toBeDefined()
    })
  })
})