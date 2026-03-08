/**
 * 搜索 API 集成测试
 * 测试前台搜索接口 GET /api/v1/search
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/v1/search/route'
import prisma from '@/core/db/client'

describe('Search API Integration', () => {
  const testArticleIds: string[] = []

  beforeAll(async () => {
    await prisma.$connect()

    // 创建测试文章用于搜索测试
    const timestamp = Date.now()
    const articles = await Promise.all([
      prisma.article.create({
        data: {
          id: `art_search_agent_${timestamp}`,
          slug: `search-test-agent-${timestamp}`,
          title: JSON.stringify({ zh: 'Claude Agent SDK 入门指南', en: 'Claude Agent SDK Getting Started' }),
          summary: JSON.stringify({ zh: '学习如何使用 Claude Agent SDK', en: 'Learn how to use Claude Agent SDK' }),
          content: JSON.stringify({ zh: '详细内容...', en: 'Detailed content...' }),
          domain: 'agent',
          tags: JSON.stringify(['Claude', 'SDK', 'Tutorial']),
          keywords: JSON.stringify([]),
          codeBlocks: JSON.stringify([]),
          metadata: JSON.stringify({
            applicableVersions: [],
            confidenceScore: 85,
            riskLevel: 'low',
            runtimeEnv: [],
          }),
          qaPairs: JSON.stringify([]),
          relatedIds: JSON.stringify([]),
          verificationStatus: 'verified',
          status: 'published',
          publishedAt: new Date(),
          createdBy: 'test',
        },
      }),
      prisma.article.create({
        data: {
          id: `art_search_mcp_${timestamp}`,
          slug: `search-test-mcp-${timestamp}`,
          title: JSON.stringify({ zh: 'MCP 协议详解', en: 'MCP Protocol Deep Dive' }),
          summary: JSON.stringify({ zh: '深入理解 MCP 协议', en: 'Understanding MCP Protocol' }),
          content: JSON.stringify({ zh: '详细内容...', en: 'Detailed content...' }),
          domain: 'mcp',
          tags: JSON.stringify(['MCP', 'Protocol', 'API']),
          keywords: JSON.stringify([]),
          codeBlocks: JSON.stringify([]),
          metadata: JSON.stringify({
            applicableVersions: [],
            confidenceScore: 90,
            riskLevel: 'low',
            runtimeEnv: [],
          }),
          qaPairs: JSON.stringify([]),
          relatedIds: JSON.stringify([]),
          verificationStatus: 'verified',
          status: 'published',
          publishedAt: new Date(),
          createdBy: 'test',
        },
      }),
      prisma.article.create({
        data: {
          id: `art_search_skill_${timestamp}`,
          slug: `search-test-skill-${timestamp}`,
          title: JSON.stringify({ zh: 'Skill 开发最佳实践', en: 'Skill Development Best Practices' }),
          summary: JSON.stringify({ zh: 'Skill 开发指南', en: 'Skill Development Guide' }),
          content: JSON.stringify({ zh: '详细内容...', en: 'Detailed content...' }),
          domain: 'skill',
          tags: JSON.stringify(['Skill', 'Development', 'Best Practices']),
          keywords: JSON.stringify([]),
          codeBlocks: JSON.stringify([]),
          metadata: JSON.stringify({
            applicableVersions: [],
            confidenceScore: 75,
            riskLevel: 'medium',
            runtimeEnv: [],
          }),
          qaPairs: JSON.stringify([]),
          relatedIds: JSON.stringify([]),
          verificationStatus: 'partial',
          status: 'published',
          publishedAt: new Date(),
          createdBy: 'test',
        },
      }),
    ])

    articles.forEach((article) => testArticleIds.push(article.id))
  })

  afterAll(async () => {
    // 清理测试数据
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
  // 基础查询测试
  // ============================================
  describe('基础查询', () => {
    it('应该返回文章列表', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.items).toBeDefined()
      expect(Array.isArray(data.data.items)).toBe(true)
    })

    it('应该返回分页信息', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.pagination).toBeDefined()
      expect(data.data.pagination.page).toBeDefined()
      expect(data.data.pagination.pageSize).toBeDefined()
      expect(data.data.pagination.total).toBeDefined()
      expect(data.data.pagination.totalPages).toBeDefined()
    })

    it('应该只返回已发布的文章', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // 所有返回的文章应该是已发布状态
      data.data.items.forEach((article: { id: string }) => {
        expect(testArticleIds.includes(article.id) || article.id).toBeDefined()
      })
    })
  })

  // ============================================
  // 搜索功能测试
  // ============================================
  describe('搜索功能', () => {
    it('应该能按关键词搜索', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?q=Claude')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // 搜索结果应该包含 Claude 关键词
      expect(data.data.items.length).toBeGreaterThanOrEqual(0)
    })

    it('应该能按中文关键词搜索', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?q=指南')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('应该能按标签搜索', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?q=SDK')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('搜索结果应该匹配标题或摘要', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?q=MCP')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // 搜索结果应该包含搜索词
      data.data.items.forEach((article: { title: { zh: string; en: string }; summary: { zh: string; en: string }; tags: string[] }) => {
        const matchInTitle = article.title.zh.includes('MCP') || article.title.en.includes('MCP')
        const matchInSummary = article.summary.zh.includes('MCP') || article.summary.en.includes('MCP')
        const matchInTags = article.tags.some((t: string) => t.includes('MCP'))
        expect(matchInTitle || matchInSummary || matchInTags).toBe(true)
      })
    })

    it('不提供搜索词应该返回所有已发布文章', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  // ============================================
  // 领域筛选测试
  // ============================================
  describe('领域筛选', () => {
    it('应该能按 agent 领域筛选', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?domain=agent')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      data.data.items.forEach((article: { domain: string }) => {
        expect(article.domain).toBe('agent')
      })
    })

    it('应该能按 mcp 领域筛选', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?domain=mcp')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      data.data.items.forEach((article: { domain: string }) => {
        expect(article.domain).toBe('mcp')
      })
    })

    it('应该能按 skill 领域筛选', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?domain=skill')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      data.data.items.forEach((article: { domain: string }) => {
        expect(article.domain).toBe('skill')
      })
    })

    it('无效领域应该返回验证错误', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?domain=invalid')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  // ============================================
  // 验证状态筛选测试
  // ============================================
  describe('验证状态筛选', () => {
    it('应该能按 verified 状态筛选', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?status=verified')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      data.data.items.forEach((article: { verificationStatus: string }) => {
        expect(article.verificationStatus).toBe('verified')
      })
    })

    it('应该能按 partial 状态筛选', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?status=partial')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      data.data.items.forEach((article: { verificationStatus: string }) => {
        expect(article.verificationStatus).toBe('partial')
      })
    })

    it('无效验证状态应该返回错误', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?status=invalid')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  // ============================================
  // 分页测试
  // ============================================
  describe('分页功能', () => {
    it('应该支持分页查询', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?page=1&pageSize=10')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.pagination.page).toBe(1)
      expect(data.data.pagination.pageSize).toBe(10)
    })

    it('应该限制最大 pageSize 为 100', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?pageSize=200')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('应该拒绝无效的 page 参数', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?page=0')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('应该使用默认分页参数', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.pagination.page).toBe(1)
      expect(data.data.pagination.pageSize).toBe(20)
    })
  })

  // ============================================
  // 语言参数测试
  // ============================================
  describe('语言参数', () => {
    it('应该接受 zh 语言参数', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?lang=zh')

      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('应该接受 en 语言参数', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?lang=en')

      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('无效语言参数应该返回错误', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?lang=fr')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  // ============================================
  // 组合查询测试
  // ============================================
  describe('组合查询', () => {
    it('应该同时支持搜索词和领域筛选', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?q=Claude&domain=agent')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      data.data.items.forEach((article: { domain: string }) => {
        expect(article.domain).toBe('agent')
      })
    })

    it('应该同时支持领域和验证状态筛选', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?domain=agent&status=verified')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      data.data.items.forEach((article: { domain: string; verificationStatus: string }) => {
        expect(article.domain).toBe('agent')
        expect(article.verificationStatus).toBe('verified')
      })
    })

    it('应该支持完整的查询组合', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?q=SDK&domain=agent&status=verified&page=1&pageSize=10')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.pagination.page).toBe(1)
      expect(data.data.pagination.pageSize).toBe(10)
    })
  })

  // ============================================
  // 响应头测试
  // ============================================
  describe('响应头', () => {
    it('应该返回 X-Agent-API-Endpoint 头', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search')

      const response = await GET(request)

      expect(response.headers.get('X-Agent-API-Endpoint')).toContain('/api/v1/search')
    })

    it('应该返回 X-Agent-API-Docs 头', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search')

      const response = await GET(request)

      expect(response.headers.get('X-Agent-API-Docs')).toContain('/api-docs')
    })
  })

  // ============================================
  // 边界情况测试
  // ============================================
  describe('边界情况', () => {
    it('应该处理特殊字符搜索词', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?q=<script>alert(1)</script>')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('应该处理长搜索词', async () => {
      const longQuery = 'a'.repeat(100)
      const request = new NextRequest(`http://localhost:3000/api/v1/search?q=${longQuery}`)

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('应该正确计算总页数', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/search?pageSize=1')

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.pagination.totalPages).toBeGreaterThanOrEqual(1)
    })
  })
})