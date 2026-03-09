/**
 * 统计 API 集成测试
 * 测试 GET /api/v1/stats
 * 测试 GET /api/admin/stats
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as PublicStats } from '@/app/api/v1/stats/route'
import { GET as AdminStats } from '@/app/api/admin/stats/route'
import prisma from '@/core/db/client'

describe('Stats API Integration', () => {
  const createdArticleIds: string[] = []

  beforeAll(async () => {
    await prisma.$connect()

    // 创建测试文章用于统计
    const timestamp = Date.now()
    const articles = await Promise.all([
      prisma.article.create({
        data: {
          id: `art_stats_1_${timestamp}`,
          slug: `stats-test-1-${timestamp}`,
          title: JSON.stringify({ zh: '统计测试1', en: 'Stats Test 1' }),
          summary: JSON.stringify({ zh: '摘要', en: 'Summary' }),
          content: JSON.stringify({ zh: '内容', en: 'Content' }),
          domain: 'agent',
          tags: JSON.stringify([]),
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
          id: `art_stats_2_${timestamp}`,
          slug: `stats-test-2-${timestamp}`,
          title: JSON.stringify({ zh: '统计测试2', en: 'Stats Test 2' }),
          summary: JSON.stringify({ zh: '摘要', en: 'Summary' }),
          content: JSON.stringify({ zh: '内容', en: 'Content' }),
          domain: 'mcp',
          tags: JSON.stringify([]),
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
    ])

    articles.forEach((a) => createdArticleIds.push(a.id))
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
  // 公开统计 API 测试
  // ============================================
  describe('GET /api/v1/stats', () => {
    it('应该返回公开统计数据', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/stats')

      const response = await PublicStats(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.articles).toBeDefined()
      expect(data.data.agents).toBeDefined()
      expect(data.data.apiRequests).toBeDefined()
    })

    it('应该返回文章统计', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/stats')

      const response = await PublicStats(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.articles.total).toBeDefined()
      expect(data.data.articles.published).toBeDefined()
      expect(data.data.articles.verified).toBeDefined()
    })

    it('应该返回 Agent 统计', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/stats')

      const response = await PublicStats(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.agents.active).toBeDefined()
    })
  })

  // ============================================
  // 管理后台统计 API 测试
  // ============================================
  describe('GET /api/admin/stats', () => {
    it('需要认证才能访问', async () => {
      const request = new NextRequest('http://localhost:3000/api/admin/stats')

      const response = await AdminStats(request)
      const data = await response.json()

      // 未认证请求应该返回 401
      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
    })
  })
})