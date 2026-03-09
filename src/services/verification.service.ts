/**
 * 验证服务
 * 负责文章验证记录的管理和验证状态更新
 * 适配 SQLite 数据库（JSON 字段使用字符串存储）
 */

import prisma from '@/core/db/client'
import { eventBus, ArticleVerifiedPayload } from '@/core/events'
import { deleteCachePattern, CacheKeys } from '@/core/cache'
import type { VerificationStatus, VerifierType } from '@/types'

// ============================================
// 类型定义
// ============================================

export interface CreateVerificationData {
  articleId: string
  verifierId: number
  result: 'passed' | 'failed' | 'partial'
  environment: {
    os: string
    runtime: string
    version: string
  }
  notes?: string
}

export interface VerificationRecord {
  id: string
  articleId: string
  verifier: {
    id: number
    type: VerifierType
    name: string
  }
  result: 'passed' | 'failed' | 'partial'
  environment: {
    os: string
    runtime: string
    version: string
  }
  notes: string | null
  verifiedAt: string
}

// ============================================
// VerificationService 类
// ============================================

export class VerificationService {
  /**
   * 创建验证记录
   */
  async createRecord(data: CreateVerificationData): Promise<VerificationRecord> {
    // 获取验证人信息
    const verifier = await prisma.verifier.findUnique({
      where: { id: data.verifierId },
      select: { id: true, type: true, name: true },
    })

    if (!verifier) {
      throw new Error(`Verifier not found: ${data.verifierId}`)
    }

    // 创建验证记录（SQLite 使用 String 存储 JSON，需要序列化）
    const record = await prisma.verificationRecord.create({
      data: {
        articleId: data.articleId,
        verifierId: data.verifierId,
        result: data.result,
        environment: JSON.stringify(data.environment),
        notes: data.notes || null,
      },
      include: {
        verifier: {
          select: { id: true, type: true, name: true },
        },
      },
    })

    // 更新文章验证状态
    await this.updateArticleStatus(data.articleId)

    // 更新验证人统计
    await this.updateVerifierStats(data.verifierId, data.result)

    // 清除文章缓存
    const article = await prisma.article.findUnique({
      where: { id: data.articleId },
      select: { slug: true },
    })
    if (article) {
      await deleteCachePattern(CacheKeys.article(data.articleId))
      await deleteCachePattern(CacheKeys.articleSlug(article.slug))
    }

    // 发布事件
    await eventBus.emit<ArticleVerifiedPayload>(
      'article:verified',
      {
        articleId: data.articleId,
        verificationId: record.id,
        result: data.result,
        verifierId: data.verifierId,
        environment: data.environment,
      },
      {
        aggregateId: data.articleId,
        aggregateType: 'Article',
        source: 'content-pipeline',
      }
    )

    return this.transformRecord(record)
  }

  /**
   * 获取文章的所有验证记录
   */
  async getRecords(articleId: string): Promise<VerificationRecord[]> {
    const records = await prisma.verificationRecord.findMany({
      where: { articleId },
      orderBy: { verifiedAt: 'desc' },
      include: {
        verifier: {
          select: { id: true, type: true, name: true },
        },
      },
    })

    return records.map(r => this.transformRecord(r))
  }

  /**
   * 获取文章最新的验证记录
   */
  async getLatestRecord(articleId: string): Promise<VerificationRecord | null> {
    const record = await prisma.verificationRecord.findFirst({
      where: { articleId },
      orderBy: { verifiedAt: 'desc' },
      include: {
        verifier: {
          select: { id: true, type: true, name: true },
        },
      },
    })

    return record ? this.transformRecord(record) : null
  }

  /**
   * 更新文章验证状态
   */
  async updateArticleStatus(articleId: string): Promise<void> {
    const records = await prisma.verificationRecord.findMany({
      where: { articleId },
      select: { result: true },
    })

    const status = this.calculateStatus(records.map(r => r.result))

    await prisma.article.update({
      where: { id: articleId },
      data: { verificationStatus: status },
    })
  }

  /**
   * 计算验证状态
   */
  private calculateStatus(results: string[]): VerificationStatus {
    if (results.length === 0) return 'pending'

    const passed = results.filter(r => r === 'passed').length
    const failed = results.filter(r => r === 'failed').length
    const total = results.length

    if (passed === total) return 'verified'
    if (failed === total) return 'failed'
    if (failed > 0) return 'partial'
    if (passed > 0) return 'partial'

    return 'pending'
  }

  /**
   * 更新验证人统计
   */
  private async updateVerifierStats(
    verifierId: number,
    result: string
  ): Promise<void> {
    // SQLite 不支持原子 increment，需要先查询再更新
    const current = await prisma.verifier.findUnique({
      where: { id: verifierId },
      select: {
        totalVerifications: true,
        passedCount: true,
        failedCount: true,
        partialCount: true,
      },
    })

    if (current) {
      const updates: Record<string, number> = {
        totalVerifications: current.totalVerifications + 1,
      }

      switch (result) {
        case 'passed':
          updates.passedCount = current.passedCount + 1
          updates.failedCount = current.failedCount
          updates.partialCount = current.partialCount
          break
        case 'failed':
          updates.passedCount = current.passedCount
          updates.failedCount = current.failedCount + 1
          updates.partialCount = current.partialCount
          break
        case 'partial':
          updates.passedCount = current.passedCount
          updates.failedCount = current.failedCount
          updates.partialCount = current.partialCount + 1
          break
        default:
          updates.passedCount = current.passedCount
          updates.failedCount = current.failedCount
          updates.partialCount = current.partialCount
      }

      await prisma.verifier.update({
        where: { id: verifierId },
        data: updates,
      })
    }
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
   * 转换数据库记录
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transformRecord(record: any): VerificationRecord {
    return {
      id: record.id,
      articleId: record.articleId,
      verifier: {
        id: record.verifier?.id || 0,
        type: (record.verifier?.type as VerifierType) || 'official_bot',
        name: record.verifier?.name || 'Unknown',
      },
      result: record.result as 'passed' | 'failed' | 'partial',
      environment: this.parseJson(record.environment, { os: '', runtime: '', version: '' }),
      notes: record.notes,
      verifiedAt: record.verifiedAt?.toISOString?.() || record.verifiedAt,
    }
  }
}

// 导出单例
export const verificationService = new VerificationService()