/**
 * ArticleService 单元测试
 * 测试文章 CRUD、发布、归档、失效等核心功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ArticleService, CreateArticleData, UpdateArticleData } from '@/services/article.service'
import prisma from '@/core/db/client'
import { eventBus } from '@/core/events'
import { deleteCachePattern, setCache, getCache } from '@/core/cache'

// Mock dependencies
vi.mock('@/core/db/client', () => ({
  default: {
    article: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    verificationRecord: {
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}))

vi.mock('@/core/events', () => ({
  eventBus: {
    emit: vi.fn(),
  },
}))

vi.mock('@/core/cache', () => ({
  deleteCachePattern: vi.fn(),
  setCache: vi.fn(),
  getCache: vi.fn(),
  CacheKeys: {
    article: (id: string) => `article:${id}`,
    articleSlug: (slug: string) => `article:slug:${slug}`,
  },
  CacheTTL: {
    medium: 300,
  },
}))

describe('ArticleService', () => {
  let articleService: ArticleService

  const mockArticle = {
    id: 'art_test123',
    slug: 'test-article',
    title: JSON.stringify({ zh: '测试文章', en: 'Test Article' }),
    summary: JSON.stringify({ zh: '摘要', en: 'Summary' }),
    content: JSON.stringify({ zh: '内容', en: 'Content' }),
    domain: 'agent',
    tags: JSON.stringify(['tag1', 'tag2']),
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
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    publishedAt: null,
    deprecatedAt: null,
    deprecatedReason: null,
    featuredAt: null,
    verificationRecords: [],
  }

  const createArticleData: CreateArticleData = {
    title: { zh: '新文章', en: 'New Article' },
    summary: { zh: '摘要', en: 'Summary' },
    content: { zh: '内容', en: 'Content' },
    domain: 'agent',
    createdBy: 'admin',
  }

  beforeEach(() => {
    articleService = new ArticleService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  // ============================================
  // findById 测试
  // ============================================
  describe('findById', () => {
    it('should return article when found', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockArticle)
      vi.mocked(getCache).mockResolvedValue(null)

      const result = await articleService.findById('art_test123')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('art_test123')
      expect(result?.title).toEqual({ zh: '测试文章', en: 'Test Article' })
      expect(prisma.article.findUnique).toHaveBeenCalledWith({
        where: { id: 'art_test123' },
        include: {
          verificationRecords: {
            orderBy: { verifiedAt: 'desc' },
            take: 10,
            include: {
              verifier: true,
            },
          },
        },
      })
    })

    it('should return null when article not found', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(null)
      vi.mocked(getCache).mockResolvedValue(null)

      const result = await articleService.findById('nonexistent')

      expect(result).toBeNull()
    })

    it('should return cached article when available', async () => {
      const cachedArticle = {
        id: 'art_cached',
        slug: 'cached-article',
        title: { zh: '缓存文章', en: 'Cached Article' },
        summary: { zh: '摘要', en: 'Summary' },
        content: { zh: '内容', en: 'Content' },
        domain: 'agent',
        tags: [],
        keywords: [],
        codeBlocks: [],
        metadata: { applicableVersions: [], confidenceScore: 0, riskLevel: 'low', runtimeEnv: [] },
        qaPairs: [],
        relatedIds: [],
        verificationStatus: 'pending',
        verificationRecords: [],
        status: 'draft',
        createdBy: 'admin',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        publishedAt: null,
      }
      vi.mocked(getCache).mockResolvedValue(cachedArticle)

      const result = await articleService.findById('art_cached')

      expect(result).toEqual(cachedArticle)
      expect(prisma.article.findUnique).not.toHaveBeenCalled()
    })

    it('should cache the article after fetching', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockArticle)
      vi.mocked(getCache).mockResolvedValue(null)

      await articleService.findById('art_test123')

      expect(setCache).toHaveBeenCalled()
    })
  })

  // ============================================
  // findBySlug 测试
  // ============================================
  describe('findBySlug', () => {
    it('should return article by slug', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockArticle)
      vi.mocked(getCache).mockResolvedValue(null)

      const result = await articleService.findBySlug('test-article')

      expect(result).not.toBeNull()
      expect(result?.slug).toBe('test-article')
      expect(prisma.article.findUnique).toHaveBeenCalledWith({
        where: { slug: 'test-article' },
        include: {
          verificationRecords: {
            orderBy: { verifiedAt: 'desc' },
            take: 10,
            include: {
              verifier: true,
            },
          },
        },
      })
    })

    it('should return null when slug not found', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(null)
      vi.mocked(getCache).mockResolvedValue(null)

      const result = await articleService.findBySlug('nonexistent-slug')

      expect(result).toBeNull()
    })
  })

  // ============================================
  // create 测试
  // ============================================
  describe('create', () => {
    it('should create article successfully', async () => {
      vi.mocked(prisma.article.create).mockResolvedValue(mockArticle)

      const result = await articleService.create(createArticleData)

      expect(result.id).toMatch(/^art_/)
      expect(result.domain).toBe('agent')
      expect(prisma.article.create).toHaveBeenCalled()
    })

    it('should generate slug from English title if not provided', async () => {
      vi.mocked(prisma.article.create).mockResolvedValue(mockArticle)

      await articleService.create(createArticleData)

      const createCall = vi.mocked(prisma.article.create).mock.calls[0][0]
      expect(createCall.data.slug).toBeDefined()
    })

    it('should use provided slug', async () => {
      vi.mocked(prisma.article.create).mockResolvedValue(mockArticle)

      const dataWithSlug: CreateArticleData = {
        ...createArticleData,
        slug: 'custom-slug',
      }

      await articleService.create(dataWithSlug)

      const createCall = vi.mocked(prisma.article.create).mock.calls[0][0]
      expect(createCall.data.slug).toBe('custom-slug')
    })

    it('should emit article:created event', async () => {
      vi.mocked(prisma.article.create).mockResolvedValue(mockArticle)

      await articleService.create(createArticleData)

      expect(eventBus.emit).toHaveBeenCalledWith(
        'article:created',
        expect.objectContaining({
          articleId: expect.any(String),
          domain: 'agent',
          createdBy: 'admin',
          status: 'draft',
        }),
        expect.objectContaining({
          aggregateType: 'Article',
          source: 'content-pipeline',
        })
      )
    })

    it('should create article with tags', async () => {
      vi.mocked(prisma.article.create).mockResolvedValue(mockArticle)

      const dataWithTags: CreateArticleData = {
        ...createArticleData,
        tags: ['Claude', 'SDK', 'Tutorial'],
      }

      await articleService.create(dataWithTags)

      const createCall = vi.mocked(prisma.article.create).mock.calls[0][0]
      expect(createCall.data.tags).toEqual(['Claude', 'SDK', 'Tutorial'])
    })

    it('should create article with code blocks', async () => {
      vi.mocked(prisma.article.create).mockResolvedValue(mockArticle)

      const dataWithCodeBlocks: CreateArticleData = {
        ...createArticleData,
        codeBlocks: [
          {
            id: 'code_1',
            language: 'typescript',
            filename: 'example.ts',
            content: 'console.log("Hello")',
            description: { zh: '示例', en: 'Example' },
          },
        ],
      }

      await articleService.create(dataWithCodeBlocks)

      const createCall = vi.mocked(prisma.article.create).mock.calls[0][0]
      const codeBlocks = createCall.data.codeBlocks as Array<{ language: string }>
      expect(codeBlocks).toHaveLength(1)
      expect(codeBlocks[0].language).toBe('typescript')
    })

    it('should create article with metadata', async () => {
      vi.mocked(prisma.article.create).mockResolvedValue(mockArticle)

      const dataWithMetadata: CreateArticleData = {
        ...createArticleData,
        metadata: {
          applicableVersions: ['1.0.0'],
          confidenceScore: 85,
          riskLevel: 'low',
          runtimeEnv: [{ name: 'Node.js', version: '18+' }],
        },
      }

      await articleService.create(dataWithMetadata)

      const createCall = vi.mocked(prisma.article.create).mock.calls[0][0]
      const metadata = createCall.data.metadata as { confidenceScore: number }
      expect(metadata.confidenceScore).toBe(85)
    })
  })

  // ============================================
  // update 测试
  // ============================================
  describe('update', () => {
    const updateData: UpdateArticleData = {
      title: { zh: '更新标题', en: 'Updated Title' },
      tags: ['new-tag'],
    }

    it('should update article successfully', async () => {
      vi.mocked(prisma.article.update).mockResolvedValue(mockArticle)

      const result = await articleService.update('art_test123', updateData)

      expect(prisma.article.update).toHaveBeenCalledWith({
        where: { id: 'art_test123' },
        data: expect.objectContaining({
          title: updateData.title,
          tags: updateData.tags,
        }),
      })
    })

    it('should clear cache after update', async () => {
      vi.mocked(prisma.article.update).mockResolvedValue(mockArticle)

      await articleService.update('art_test123', updateData)

      expect(deleteCachePattern).toHaveBeenCalled()
    })

    it('should emit article:updated event', async () => {
      vi.mocked(prisma.article.update).mockResolvedValue(mockArticle)

      await articleService.update('art_test123', updateData)

      expect(eventBus.emit).toHaveBeenCalledWith(
        'article:updated',
        expect.objectContaining({
          articleId: 'art_test123',
          updatedBy: 'system',
          changes: expect.arrayContaining(['title', 'tags']),
        }),
        expect.any(Object)
      )
    })

    it('should update only provided fields', async () => {
      vi.mocked(prisma.article.update).mockResolvedValue(mockArticle)

      const partialUpdate: UpdateArticleData = {
        tags: ['only-tags'],
      }

      await articleService.update('art_test123', partialUpdate)

      const updateCall = vi.mocked(prisma.article.update).mock.calls[0][0]
      expect(updateCall.data.title).toBeUndefined()
      expect(updateCall.data.tags).toEqual(["only-tags"])
    })

    it('should throw error when article not found', async () => {
      vi.mocked(prisma.article.update).mockRejectedValue(new Error('Record not found'))

      await expect(articleService.update('nonexistent', updateData)).rejects.toThrow()
    })
  })

  // ============================================
  // delete 测试
  // ============================================
  describe('delete', () => {
    it('should delete article successfully', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockArticle)
      vi.mocked(prisma.verificationRecord.deleteMany).mockResolvedValue({ count: 0 })
      vi.mocked(prisma.article.delete).mockResolvedValue(mockArticle)

      await articleService.delete('art_test123')

      expect(prisma.verificationRecord.deleteMany).toHaveBeenCalledWith({
        where: { articleId: 'art_test123' },
      })
      expect(prisma.article.delete).toHaveBeenCalledWith({
        where: { id: 'art_test123' },
      })
    })

    it('should clear cache after delete', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockArticle)
      vi.mocked(prisma.verificationRecord.deleteMany).mockResolvedValue({ count: 0 })
      vi.mocked(prisma.article.delete).mockResolvedValue(mockArticle)

      await articleService.delete('art_test123')

      expect(deleteCachePattern).toHaveBeenCalled()
    })

    it('should delete associated verification records', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockArticle)
      vi.mocked(prisma.verificationRecord.deleteMany).mockResolvedValue({ count: 3 })
      vi.mocked(prisma.article.delete).mockResolvedValue(mockArticle)

      await articleService.delete('art_test123')

      expect(prisma.verificationRecord.deleteMany).toHaveBeenCalledWith({
        where: { articleId: 'art_test123' },
      })
    })
  })

  // ============================================
  // publish 测试
  // ============================================
  describe('publish', () => {
    const publishedArticle = {
      ...mockArticle,
      status: 'published',
      publishedAt: new Date(),
    }

    it('should publish article successfully', async () => {
      vi.mocked(prisma.article.update).mockResolvedValue(publishedArticle)

      const result = await articleService.publish('art_test123', 'admin')

      expect(result.status).toBe('published')
      expect(result.publishedAt).toBeDefined()
    })

    it('should set publishedAt date', async () => {
      vi.mocked(prisma.article.update).mockResolvedValue(publishedArticle)

      await articleService.publish('art_test123')

      const updateCall = vi.mocked(prisma.article.update).mock.calls[0][0]
      expect(updateCall.data.status).toBe('published')
      expect(updateCall.data.publishedAt).toBeInstanceOf(Date)
    })

    it('should emit article:published event', async () => {
      vi.mocked(prisma.article.update).mockResolvedValue(publishedArticle)

      await articleService.publish('art_test123', 'admin')

      expect(eventBus.emit).toHaveBeenCalledWith(
        'article:published',
        expect.objectContaining({
          articleId: 'art_test123',
          publishedBy: 'admin',
        }),
        expect.any(Object)
      )
    })

    it('should clear cache after publish', async () => {
      vi.mocked(prisma.article.update).mockResolvedValue(publishedArticle)

      await articleService.publish('art_test123')

      expect(deleteCachePattern).toHaveBeenCalled()
    })
  })

  // ============================================
  // archive 测试
  // ============================================
  describe('archive', () => {
    const archivedArticle = {
      ...mockArticle,
      status: 'archived',
    }

    it('should archive article successfully', async () => {
      vi.mocked(prisma.article.update).mockResolvedValue(archivedArticle)

      const result = await articleService.archive('art_test123')

      expect(result.status).toBe('archived')
    })

    it('should clear cache after archive', async () => {
      vi.mocked(prisma.article.update).mockResolvedValue(archivedArticle)

      await articleService.archive('art_test123')

      expect(deleteCachePattern).toHaveBeenCalled()
    })
  })

  // ============================================
  // deprecate 测试
  // ============================================
  describe('deprecate', () => {
    const deprecatedArticle = {
      ...mockArticle,
      status: 'deprecated',
      deprecatedAt: new Date(),
      deprecatedReason: 'Content outdated',
    }

    it('should deprecate article successfully', async () => {
      vi.mocked(prisma.article.update).mockResolvedValue(deprecatedArticle)

      const result = await articleService.deprecate('art_test123', 'Content outdated')

      expect(result.status).toBe('deprecated')
    })

    it('should set deprecatedAt and deprecatedReason', async () => {
      vi.mocked(prisma.article.update).mockResolvedValue(deprecatedArticle)

      await articleService.deprecate('art_test123', 'Test reason')

      const updateCall = vi.mocked(prisma.article.update).mock.calls[0][0]
      expect(updateCall.data.status).toBe('deprecated')
      expect(updateCall.data.deprecatedReason).toBe('Test reason')
      expect(updateCall.data.deprecatedAt).toBeInstanceOf(Date)
    })

    it('should clear cache after deprecate', async () => {
      vi.mocked(prisma.article.update).mockResolvedValue(deprecatedArticle)

      await articleService.deprecate('art_test123', 'Test reason')

      expect(deleteCachePattern).toHaveBeenCalled()
    })
  })

  // ============================================
  // search 测试
  // ============================================
  describe('search', () => {
    const mockArticles = [mockArticle]

    it('should return paginated articles', async () => {
      vi.mocked(prisma.article.findMany).mockResolvedValue(mockArticles)
      vi.mocked(prisma.article.count).mockResolvedValue(1)

      const result = await articleService.search({ page: 1, pageSize: 20 })

      expect(result.articles).toHaveLength(1)
      expect(result.pagination.page).toBe(1)
      expect(result.pagination.total).toBe(1)
    })

    it('should filter by status', async () => {
      vi.mocked(prisma.article.findMany).mockResolvedValue(mockArticles)
      vi.mocked(prisma.article.count).mockResolvedValue(1)

      await articleService.search({ status: ['draft'] })

      const findManyCall = vi.mocked(prisma.article.findMany).mock.calls[0][0]
      expect(findManyCall.where.status).toEqual({ in: ['draft'] })
    })

    it('should filter by domain', async () => {
      vi.mocked(prisma.article.findMany).mockResolvedValue(mockArticles)
      vi.mocked(prisma.article.count).mockResolvedValue(1)

      await articleService.search({ domain: ['agent'] })

      const findManyCall = vi.mocked(prisma.article.findMany).mock.calls[0][0]
      expect(findManyCall.where.domain).toEqual({ in: ['agent'] })
    })

    it('should filter by verification status', async () => {
      vi.mocked(prisma.article.findMany).mockResolvedValue(mockArticles)
      vi.mocked(prisma.article.count).mockResolvedValue(1)

      await articleService.search({ verificationStatus: ['verified'] })

      const findManyCall = vi.mocked(prisma.article.findMany).mock.calls[0][0]
      expect(findManyCall.where.verificationStatus).toEqual({ in: ['verified'] })
    })

    it('should search by query string', async () => {
      vi.mocked(prisma.article.findMany).mockResolvedValue(mockArticles)
      vi.mocked(prisma.article.count).mockResolvedValue(1)

      await articleService.search({ query: 'test' })

      const findManyCall = vi.mocked(prisma.article.findMany).mock.calls[0][0]
      expect(findManyCall.where.OR).toBeDefined()
      expect(findManyCall.where.OR).toHaveLength(2)
    })

    it('should filter by date range', async () => {
      vi.mocked(prisma.article.findMany).mockResolvedValue(mockArticles)
      vi.mocked(prisma.article.count).mockResolvedValue(1)

      await articleService.search({
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
      })

      const findManyCall = vi.mocked(prisma.article.findMany).mock.calls[0][0]
      expect(findManyCall.where.createdAt).toBeDefined()
      expect(findManyCall.where.createdAt.gte).toBeInstanceOf(Date)
      expect(findManyCall.where.createdAt.lte).toBeInstanceOf(Date)
    })

    it('should calculate total pages correctly', async () => {
      vi.mocked(prisma.article.findMany).mockResolvedValue(mockArticles)
      vi.mocked(prisma.article.count).mockResolvedValue(45)

      const result = await articleService.search({ page: 1, pageSize: 20 })

      expect(result.pagination.totalPages).toBe(3)
    })

    it('should sort by date descending by default', async () => {
      vi.mocked(prisma.article.findMany).mockResolvedValue(mockArticles)
      vi.mocked(prisma.article.count).mockResolvedValue(1)

      await articleService.search({})

      const findManyCall = vi.mocked(prisma.article.findMany).mock.calls[0][0]
      expect(findManyCall.orderBy).toEqual({ createdAt: 'desc' })
    })

    it('should return empty array when no results', async () => {
      vi.mocked(prisma.article.findMany).mockResolvedValue([])
      vi.mocked(prisma.article.count).mockResolvedValue(0)

      const result = await articleService.search({})

      expect(result.articles).toHaveLength(0)
      expect(result.pagination.total).toBe(0)
    })
  })

  // ============================================
  // findByIds 测试
  // ============================================
  describe('findByIds', () => {
    it('should return articles by ids', async () => {
      vi.mocked(prisma.article.findMany).mockResolvedValue([mockArticle])

      const result = await articleService.findByIds(['art_test123'])

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('art_test123')
    })

    it('should return empty array for empty ids', async () => {
      const result = await articleService.findByIds([])

      expect(result).toHaveLength(0)
      expect(prisma.article.findMany).not.toHaveBeenCalled()
    })

    it('should return multiple articles', async () => {
      const mockArticle2 = { ...mockArticle, id: 'art_test456' }
      vi.mocked(prisma.article.findMany).mockResolvedValue([mockArticle, mockArticle2])

      const result = await articleService.findByIds(['art_test123', 'art_test456'])

      expect(result).toHaveLength(2)
    })
  })

  // ============================================
  // getRelated 测试
  // ============================================
  describe('getRelated', () => {
    it('should return related articles', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue({
        ...mockArticle,
        relatedIds: JSON.stringify(['art_related1', 'art_related2']),
      })
      vi.mocked(prisma.article.findMany).mockResolvedValue([
        { ...mockArticle, id: 'art_related1' },
        { ...mockArticle, id: 'art_related2' },
      ])

      const result = await articleService.getRelated('art_test123')

      expect(prisma.article.findUnique).toHaveBeenCalledWith({
        where: { id: 'art_test123' },
        select: { relatedIds: true },
      })
    })

    it('should return empty array when article not found', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue(null)

      const result = await articleService.getRelated('nonexistent')

      expect(result).toHaveLength(0)
    })

    it('should return empty array when no related ids', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue({
        ...mockArticle,
        relatedIds: JSON.stringify([]),
      })

      const result = await articleService.getRelated('art_test123')

      expect(result).toHaveLength(0)
    })

    it('should limit related articles', async () => {
      vi.mocked(prisma.article.findUnique).mockResolvedValue({
        ...mockArticle,
        relatedIds: JSON.stringify(['r1', 'r2', 'r3', 'r4', 'r5', 'r6']),
      })
      vi.mocked(prisma.article.findMany).mockResolvedValue([])

      await articleService.getRelated('art_test123', 3)

      const findManyCall = vi.mocked(prisma.article.findMany).mock.calls[0][0]
      expect(findManyCall.where.id.in).toHaveLength(3)
    })
  })
})