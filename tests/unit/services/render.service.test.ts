/**
 * RenderService 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RenderService } from '@/services/render.service'
import type { Article, CodeBlock, QAPair } from '@/types'

// Mock Redis cache
vi.mock('@/core/cache', () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  deleteCachePattern: vi.fn().mockResolvedValue(undefined),
  CacheKeys: {
    article: (id: string) => `article:${id}`,
    articleSlug: (slug: string) => `article:slug:${slug}`,
    renderHuman: (id: string, lang: string) => `render:human:${id}:${lang}`,
    renderAgent: (id: string, format: string) => `render:agent:${id}:${format}`,
  },
  CacheTTL: {
    short: 60,
    medium: 3600,
    long: 86400,
  },
}))

// 创建测试用的文章数据
function createMockArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'art_test123',
    slug: 'test-article',
    title: { zh: '测试文章', en: 'Test Article' },
    summary: { zh: '测试摘要', en: 'Test Summary' },
    content: { zh: '# 测试内容\n\n这是测试。', en: '# Test Content\n\nThis is a test.' },
    domain: 'agent',
    tags: ['test', 'mock'],
    keywords: ['测试', 'test'],
    codeBlocks: [
      {
        id: 'code-1',
        language: 'javascript',
        filename: 'test.js',
        content: 'console.log("Hello");',
        description: { zh: '测试代码', en: 'Test code' },
      },
    ] as CodeBlock[],
    metadata: {
      applicableVersions: ['1.0'],
      confidenceScore: 85,
      riskLevel: 'low',
      runtimeEnv: [{ name: 'node', version: '18.x' }],
    },
    qaPairs: [
      {
        id: 'qa-1',
        question: { zh: '这是什么？', en: 'What is this?' },
        answer: { zh: '这是一个测试。', en: 'This is a test.' },
      },
    ] as QAPair[],
    relatedIds: ['art_related1'],
    verificationStatus: 'verified',
    verificationRecords: [],
    status: 'published',
    createdBy: 'test-user',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    publishedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('RenderService', () => {
  let service: RenderService

  beforeEach(() => {
    service = new RenderService()
    vi.clearAllMocks()
  })

  describe('renderHuman', () => {
    it('should render article as HTML', async () => {
      const article = createMockArticle()

      const result = await service.renderHuman(article, 'zh')

      expect(result.contentType).toBe('text/html')
      expect(result.content).toContain('<!DOCTYPE html>')
      expect(result.content).toContain('测试文章')
      expect(result.cached).toBe(false)
    })

    it('should render English content', async () => {
      const article = createMockArticle()

      const result = await service.renderHuman(article, 'en')

      expect(result.content).toContain('Test Article')
      expect(result.content).toContain('Test Summary')
    })

    it('should include markdown content in HTML', async () => {
      const article = createMockArticle()

      const result = await service.renderHuman(article, 'zh')

      // 验证 HTML 结构包含标题和内容
      expect(result.content).toContain('<h1>测试内容</h1>')
      expect(result.content).toContain('这是测试')
    })

    it('should report render time', async () => {
      const article = createMockArticle()

      const result = await service.renderHuman(article, 'zh')

      expect(result.renderTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('renderAgent', () => {
    it('should render article as Markdown', async () => {
      const article = createMockArticle()

      const result = await service.renderAgent(article, 'markdown', 'en')

      expect(result.contentType).toBe('text/markdown')
      expect(result.content).toContain('# Test Article')
      expect(result.content).toContain('Test Summary')
    })

    it('should render article as JSON', async () => {
      const article = createMockArticle()

      const result = await service.renderAgent(article, 'json', 'en')

      expect(result.contentType).toBe('application/json')
      const parsed = JSON.parse(result.content)
      expect(parsed.id).toBe('art_test123')
      // toJsonResponse 返回扁平化的 title 字符串（根据语言提取）
      expect(parsed.title).toBe('Test Article')
    })

    it('should include code blocks in Markdown', async () => {
      const article = createMockArticle()

      const result = await service.renderAgent(article, 'markdown', 'en')

      expect(result.content).toContain('```javascript')
      expect(result.content).toContain('console.log')
    })

    it('should include Q&A pairs in Markdown', async () => {
      const article = createMockArticle()

      const result = await service.renderAgent(article, 'markdown', 'en')

      expect(result.content).toContain('Q:')
      expect(result.content).toContain('What is this?')
    })

    it('should include metadata in JSON', async () => {
      const article = createMockArticle()

      const result = await service.renderAgent(article, 'json', 'en')

      const parsed = JSON.parse(result.content)
      expect(parsed.domain).toBe('agent')
      expect(parsed.tags).toContain('test')
      expect(parsed.verificationStatus).toBe('verified')
    })
  })

  describe('invalidateCache', () => {
    it('should invalidate cache without error', async () => {
      const article = createMockArticle()

      // 不应该抛出异常
      await expect(service.invalidateCache(article.id)).resolves.not.toThrow()
    })
  })

  describe('preRender', () => {
    it('should handle empty array', async () => {
      await expect(service.preRender([])).resolves.not.toThrow()
    })

    it('should process article IDs', async () => {
      // 不应该抛出异常
      await expect(service.preRender(['art_1', 'art_2'])).resolves.not.toThrow()
    })
  })
})