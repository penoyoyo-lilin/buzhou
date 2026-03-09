/**
 * 文章服务
 * 负责文章的 CRUD 操作、搜索、发布等业务逻辑
 * 兼容 SQLite 和 PostgreSQL 数据库
 */

import prisma from '@/core/db/client'
import { toJsonValue } from '@/core/db/utils'
import { eventBus, ArticleCreatedPayload, ArticlePublishedPayload, ArticleUpdatedPayload } from '@/core/events'
import { deleteCachePattern, CacheKeys, CacheTTL, setCache, getCache } from '@/core/cache'
import { nanoid } from 'nanoid'
import type {
  Article,
  ArticleDomain,
  ArticlePriority,
  ArticleStatus,
  VerificationStatus,
  VerifierType,
  LocalizedString,
  CodeBlock,
  ArticleMetadata,
  QAPair,
  Pagination,
  VerificationRecord,
} from '@/types'

// ============================================
// 类型定义
// ============================================

export interface CreateArticleData {
  slug?: string
  title: LocalizedString
  summary: LocalizedString
  content: LocalizedString
  domain: ArticleDomain
  priority?: ArticlePriority
  tags?: string[]
  keywords?: string[] // 关键词，用于辅助决策
  codeBlocks?: CodeBlock[]
  metadata?: ArticleMetadata
  qaPairs?: QAPair[]
  relatedIds?: string[]
  createdBy: string
  skipVerification?: boolean
}

export interface UpdateArticleData {
  title?: LocalizedString
  summary?: LocalizedString
  content?: LocalizedString
  domain?: ArticleDomain
  priority?: ArticlePriority
  tags?: string[]
  keywords?: string[]
  codeBlocks?: CodeBlock[]
  metadata?: ArticleMetadata
  qaPairs?: QAPair[]
  relatedIds?: string[]
}

export interface SearchParams {
  query?: string
  domain?: ArticleDomain[]
  status?: ArticleStatus[]
  verificationStatus?: VerificationStatus[]
  tags?: string[]
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
  sortBy?: 'relevance' | 'date' | 'confidence'
  lang?: 'zh' | 'en'
}

export interface SearchResult {
  articles: Article[]
  pagination: Pagination
}

// ============================================
// ArticleService 类
// ============================================

export class ArticleService {
  /**
   * 按 ID 查询文章
   */
  async findById(id: string): Promise<Article | null> {
    const cacheKey = CacheKeys.article(id)
    const cached = await getCache<Article>(cacheKey)
    if (cached) return cached

    const article = await prisma.article.findUnique({
      where: { id },
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

    if (!article) return null

    const result = this.transformArticle(article)
    await setCache(cacheKey, result, CacheTTL.medium)
    return result
  }

  /**
   * 按 slug 查询文章
   */
  async findBySlug(slug: string): Promise<Article | null> {
    const cacheKey = CacheKeys.articleSlug(slug)
    const cached = await getCache<Article>(cacheKey)
    if (cached) return cached

    const article = await prisma.article.findUnique({
      where: { slug },
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

    if (!article) return null

    const result = this.transformArticle(article)
    await setCache(cacheKey, result, CacheTTL.medium)
    return result
  }

  /**
   * 批量查询文章
   */
  async findByIds(ids: string[]): Promise<Article[]> {
    if (ids.length === 0) return []

    const articles = await prisma.article.findMany({
      where: { id: { in: ids } },
      include: {
        verificationRecords: {
          orderBy: { verifiedAt: 'desc' },
          take: 5,
          include: {
            verifier: true,
          },
        },
      },
    })

    return articles.map(a => this.transformArticle(a))
  }

  /**
   * 搜索文章
   */
  async search(params: SearchParams): Promise<SearchResult> {
    const {
      query,
      domain,
      status,
      verificationStatus,
      dateFrom,
      dateTo,
      page = 1,
      pageSize = 20,
      sortBy = 'date',
    } = params

    // 构建查询条件
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (domain && domain.length > 0) {
      where.domain = { in: domain }
    }

    if (status && status.length > 0) {
      where.status = { in: status }
    }

    if (verificationStatus && verificationStatus.length > 0) {
      where.verificationStatus = { in: verificationStatus }
    }

    if (dateFrom || dateTo) {
      const dateFilter: Record<string, Date> = {}
      if (dateFrom) dateFilter.gte = new Date(dateFrom)
      if (dateTo) dateFilter.lte = new Date(dateTo)
      where.createdAt = dateFilter
    }

    // 全文搜索（SQLite 不支持高级搜索，使用简单的 LIKE）
    if (query) {
      where.OR = [
        { title: { contains: query } },
        { summary: { contains: query } },
      ]
    }

    // 排序
    const orderBy: Record<string, string> = {}
    switch (sortBy) {
      case 'date':
        orderBy.createdAt = 'desc'
        break
      case 'confidence':
        orderBy.createdAt = 'desc'
        break
      default:
        orderBy.createdAt = 'desc'
    }

    // 查询
    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include: {
          verificationRecords: {
            orderBy: { verifiedAt: 'desc' },
            take: 1,
            include: {
              verifier: true,
            },
          },
        },
      }),
      prisma.article.count({ where }),
    ])

    const totalPages = Math.ceil(total / pageSize)

    return {
      articles: articles.map(a => this.transformArticle(a)),
      pagination: { page, pageSize, total, totalPages },
    }
  }

  /**
   * 创建文章
   */
  async create(data: CreateArticleData): Promise<Article> {
    // 生成 slug
    const slug = data.slug || this.generateSlug(data.title.en)

    // 生成 ID
    const id = `art_${nanoid(12)}`

    // 创建文章（兼容 SQLite 和 PostgreSQL）
    const article = await prisma.article.create({
      data: {
        id,
        slug,
        title: toJsonValue(data.title) as any,
        summary: toJsonValue(data.summary) as any,
        content: toJsonValue(data.content) as any,
        domain: data.domain as any,
        priority: data.priority || 'P1',
        tags: toJsonValue(data.tags || []) as any,
        keywords: toJsonValue(data.keywords || []) as any,
        codeBlocks: toJsonValue(data.codeBlocks || []) as any,
        metadata: toJsonValue(data.metadata || this.defaultMetadata()) as any,
        qaPairs: toJsonValue(data.qaPairs || []) as any,
        relatedIds: toJsonValue(data.relatedIds || []) as any,
        createdBy: data.createdBy,
      },
    })

    const result = this.transformArticle(article)

    // 发布事件
    await eventBus.emit<ArticleCreatedPayload>(
      'article:created',
      {
        articleId: id,
        domain: data.domain,
        createdBy: data.createdBy,
        status: 'draft',
      },
      {
        aggregateId: id,
        aggregateType: 'Article',
        source: 'content-pipeline',
      }
    )

    return result
  }

  /**
   * 批量创建文章
   */
  async bulkCreate(items: CreateArticleData[]): Promise<Article[]> {
    const results: Article[] = []

    for (const item of items) {
      try {
        const article = await this.create(item)
        results.push(article)
      } catch (error) {
        console.error('Failed to create article:', error)
      }
    }

    return results
  }

  /**
   * 更新文章
   */
  async update(id: string, data: UpdateArticleData): Promise<Article> {
    // 构建更新数据（使用 toJsonValue 兼容 SQLite 和 PostgreSQL）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

    if (data.title) updateData.title = toJsonValue(data.title)
    if (data.summary) updateData.summary = toJsonValue(data.summary)
    if (data.content) updateData.content = toJsonValue(data.content)
    if (data.domain) updateData.domain = data.domain
    if (data.tags) updateData.tags = toJsonValue(data.tags)
    if (data.keywords) updateData.keywords = toJsonValue(data.keywords)
    if (data.codeBlocks) updateData.codeBlocks = toJsonValue(data.codeBlocks)
    if (data.metadata) updateData.metadata = toJsonValue(data.metadata)
    if (data.qaPairs) updateData.qaPairs = toJsonValue(data.qaPairs)
    if (data.relatedIds) updateData.relatedIds = toJsonValue(data.relatedIds)

    const article = await prisma.article.update({
      where: { id },
      data: updateData,
    })

    const result = this.transformArticle(article)

    // 清除缓存
    await this.invalidateCache(id, article.slug)

    // 发布事件
    const changes = Object.keys(data)
    await eventBus.emit<ArticleUpdatedPayload>(
      'article:updated',
      {
        articleId: id,
        updatedBy: 'system',
        changes,
      },
      {
        aggregateId: id,
        aggregateType: 'Article',
        source: 'content-pipeline',
      }
    )

    return result
  }

  /**
   * 发布文章
   */
  async publish(id: string, publishedBy: string = 'system'): Promise<Article> {
    const article = await prisma.article.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    })

    const result = this.transformArticle(article)

    // 清除缓存
    await this.invalidateCache(id, article.slug)

    // 发布事件
    await eventBus.emit<ArticlePublishedPayload>(
      'article:published',
      {
        articleId: id,
        publishedAt: result.publishedAt!,
        publishedBy,
      },
      {
        aggregateId: id,
        aggregateType: 'Article',
        source: 'content-pipeline',
      }
    )

    return result
  }

  /**
   * 归档文章
   */
  async archive(id: string): Promise<Article> {
    const article = await prisma.article.update({
      where: { id },
      data: { status: 'archived' },
    })

    const result = this.transformArticle(article)
    await this.invalidateCache(id, article.slug)
    return result
  }

  /**
   * 标记文章失效
   */
  async deprecate(id: string, reason: string): Promise<Article> {
    const article = await prisma.article.update({
      where: { id },
      data: {
        status: 'deprecated',
        deprecatedAt: new Date(),
        deprecatedReason: reason,
      },
    })

    const result = this.transformArticle(article)
    await this.invalidateCache(id, article.slug)
    return result
  }

  /**
   * 删除文章
   */
  async delete(id: string): Promise<void> {
    const article = await prisma.article.findUnique({
      where: { id },
      select: { slug: true },
    })

    // 先删除关联的验证记录
    await prisma.verificationRecord.deleteMany({
      where: { articleId: id },
    })

    await prisma.article.delete({ where: { id } })

    if (article) {
      await this.invalidateCache(id, article.slug)
    }
  }

  /**
   * 获取关联文章
   */
  async getRelated(id: string, limit: number = 5): Promise<Article[]> {
    const article = await prisma.article.findUnique({
      where: { id },
      select: { relatedIds: true },
    })

    if (!article) {
      return []
    }

    const relatedIds = this.parseJson<string[]>(article.relatedIds, [])
    if (relatedIds.length === 0) {
      return []
    }

    const limitedIds = relatedIds.slice(0, limit)
    return this.findByIds(limitedIds)
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 生成 slug
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100)
  }

  /**
   * 默认元数据
   */
  private defaultMetadata(): ArticleMetadata {
    return {
      applicableVersions: [],
      confidenceScore: 0,
      riskLevel: 'low',
      runtimeEnv: [],
    }
  }

  /**
   * 清除文章缓存
   */
  private async invalidateCache(id: string, slug: string): Promise<void> {
    await Promise.all([
      deleteCachePattern(CacheKeys.article(id)),
      deleteCachePattern(CacheKeys.articleSlug(slug)),
      deleteCachePattern(`render:*:${id}:*`),
    ])
  }

  /**
   * 安全获取 JSON 值（PostgreSQL 的 Json 类型返回已解析的对象）
   */
  private parseJson<T>(value: unknown, defaultValue: T): T {
    if (!value) return defaultValue
    // PostgreSQL 的 Json 类型返回已解析的对象，直接返回
    if (typeof value !== 'string') return value as T
    // 如果是字符串（SQLite 兼容），尝试解析
    try {
      return JSON.parse(value) as T
    } catch {
      return defaultValue
    }
  }

  /**
   * 转换数据库记录为 Article 类型
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformArticle(record: any): Article {
    return {
      id: record.id,
      slug: record.slug,
      title: this.parseJson<LocalizedString>(record.title, { zh: '', en: '' }),
      summary: this.parseJson<LocalizedString>(record.summary, { zh: '', en: '' }),
      content: this.parseJson<LocalizedString>(record.content, { zh: '', en: '' }),
      domain: record.domain as ArticleDomain,
      tags: this.parseJson<string[]>(record.tags, []),
      keywords: this.parseJson<string[]>(record.keywords, []),
      priority: record.priority as ArticlePriority || 'P1',
      codeBlocks: this.parseJson<CodeBlock[]>(record.codeBlocks, []),
      metadata: this.parseJson<ArticleMetadata>(record.metadata, this.defaultMetadata()),
      qaPairs: this.parseJson<QAPair[]>(record.qaPairs, []),
      relatedIds: this.parseJson<string[]>(record.relatedIds, []),
      verificationStatus: record.verificationStatus as VerificationStatus,
      verificationRecords: (record.verificationRecords || []).map((v: { id: string; articleId: string; verifierId: string; verifier?: { id: string; type: string; name: string }; result: string; environment: string; notes: string | null; verifiedAt: Date }) => ({
        id: v.id,
        articleId: v.articleId,
        verifier: v.verifier ? {
          id: v.verifier.id,
          type: v.verifier.type as VerifierType,
          name: v.verifier.name,
        } : { id: v.verifierId, type: 'official_bot' as VerifierType, name: 'Unknown' },
        result: v.result as 'passed' | 'failed' | 'partial',
        environment: this.parseJson(v.environment, { os: '', runtime: '', version: '' }),
        notes: v.notes,
        verifiedAt: v.verifiedAt?.toISOString?.() || v.verifiedAt,
      })),
      status: record.status as ArticleStatus,
      createdBy: record.createdBy,
      createdAt: record.createdAt?.toISOString?.() || record.createdAt,
      updatedAt: record.updatedAt?.toISOString?.() || record.updatedAt,
      publishedAt: record.publishedAt?.toISOString?.() || record.publishedAt,
    }
  }
}

// 导出单例
export const articleService = new ArticleService()