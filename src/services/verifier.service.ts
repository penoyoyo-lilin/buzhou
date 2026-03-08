/**
 * 验证人服务
 * 负责验证人的管理和信誉系统
 * 适配 SQLite 数据库（JSON 字段使用字符串存储）
 */

import prisma from '@/core/db/client'
import { eventBus, VerifierRegisteredPayload } from '@/core/events'
import { CacheKeys, CacheTTL, setCache, getCache, deleteCache } from '@/core/cache'
import type { VerifierType, VerifierStatus, ReputationLevel } from '@/types'

// ============================================
// 类型定义
// ============================================

export interface CreateVerifierData {
  type: VerifierType
  name: string
  description: string
  credentials?: {
    publicKey?: string
    certificateUrl?: string
    verified?: boolean
  }
}

export interface UpdateVerifierData {
  name?: string
  description?: string
  status?: VerifierStatus
  credentials?: {
    publicKey?: string
    certificateUrl?: string
    verified?: boolean
  }
}

export interface VerifierStats {
  totalVerifications: number
  passedCount: number
  failedCount: number
  partialCount: number
}

export interface Verifier {
  id: number
  type: VerifierType
  name: string
  description: string
  credentials: {
    publicKey?: string
    certificateUrl?: string
    verified: boolean
  }
  reputation: {
    score: number
    level: ReputationLevel
    totalVerifications: number
  }
  stats: VerifierStats
  status: VerifierStatus
  createdAt: string
}

// ============================================
// VerifierService 类
// ============================================

export class VerifierService {
  /**
   * 按 ID 查询验证人
   */
  async findById(id: number): Promise<Verifier | null> {
    const cacheKey = CacheKeys.verifier(String(id))
    const cached = await getCache<Verifier>(cacheKey)
    if (cached) return cached

    const verifier = await prisma.verifier.findUnique({
      where: { id },
    })

    if (!verifier) return null

    const result = this.transformVerifier(verifier)
    await setCache(cacheKey, result, CacheTTL.medium)
    return result
  }

  /**
   * 按类型查询验证人
   */
  async findByType(type: VerifierType): Promise<Verifier[]> {
    const verifiers = await prisma.verifier.findMany({
      where: { type, status: 'active' },
      orderBy: { reputationScore: 'desc' },
    })

    return verifiers.map(v => this.transformVerifier(v))
  }

  /**
   * 列表查询
   */
  async list(params?: {
    type?: VerifierType
    status?: VerifierStatus
    page?: number
    pageSize?: number
  }): Promise<{ verifiers: Verifier[]; total: number }> {
    const { type, status, page = 1, pageSize = 20 } = params || {}

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}
    if (type) where.type = type
    if (status) where.status = status

    const [verifiers, total] = await Promise.all([
      prisma.verifier.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { reputationScore: 'desc' },
      }),
      prisma.verifier.count({ where }),
    ])

    return {
      verifiers: verifiers.map(v => this.transformVerifier(v)),
      total,
    }
  }

  /**
   * 创建验证人
   */
  async create(data: CreateVerifierData): Promise<Verifier> {
    const verifier = await prisma.verifier.create({
      data: {
        type: data.type,
        name: data.name,
        description: data.description,
        credentials: data.credentials || { verified: false },
      },
    })

    const result = this.transformVerifier(verifier)

    // 发布事件
    await eventBus.emit<VerifierRegisteredPayload>(
      'verifier:registered',
      {
        verifierId: verifier.id,
        type: data.type,
        name: data.name,
      },
      {
        aggregateId: String(verifier.id),
        aggregateType: 'Verifier',
        source: 'content-pipeline',
      }
    )

    return result
  }

  /**
   * 更新验证人
   */
  async update(id: number, data: UpdateVerifierData): Promise<Verifier> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

    if (data.name) updateData.name = data.name
    if (data.description) updateData.description = data.description
    if (data.status) updateData.status = data.status
    if (data.credentials) updateData.credentials = data.credentials

    const verifier = await prisma.verifier.update({
      where: { id },
      data: updateData,
    })

    const result = this.transformVerifier(verifier)

    // 清除缓存
    await deleteCache(CacheKeys.verifier(String(id)))

    return result
  }

  /**
   * 更新信誉分数
   */
  async updateReputation(
    id: number,
    delta: number,
    _reason: string
  ): Promise<Verifier> {
    const current = await prisma.verifier.findUnique({
      where: { id },
      select: { reputationScore: true },
    })

    if (!current) {
      throw new Error(`Verifier not found: ${id}`)
    }

    const newScore = Math.max(0, Math.min(100, current.reputationScore + delta))
    const newLevel = this.calculateLevel(newScore)

    const verifier = await prisma.verifier.update({
      where: { id },
      data: {
        reputationScore: newScore,
        reputationLevel: newLevel,
      },
    })

    const result = this.transformVerifier(verifier)

    // 清除缓存
    await deleteCache(CacheKeys.verifier(String(id)))

    return result
  }

  /**
   * 获取验证人统计
   */
  async getStats(id: number): Promise<VerifierStats> {
    const verifier = await prisma.verifier.findUnique({
      where: { id },
      select: {
        totalVerifications: true,
        passedCount: true,
        failedCount: true,
        partialCount: true,
      },
    })

    if (!verifier) {
      throw new Error(`Verifier not found: ${id}`)
    }

    return {
      totalVerifications: verifier.totalVerifications,
      passedCount: verifier.passedCount,
      failedCount: verifier.failedCount,
      partialCount: verifier.partialCount,
    }
  }

  // ============================================
  // 私有方法
  // ============================================

  /**
   * 计算信誉等级
   */
  private calculateLevel(score: number): ReputationLevel {
    if (score >= 80) return 'master'
    if (score >= 60) return 'expert'
    if (score >= 30) return 'intermediate'
    return 'beginner'
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
  private transformVerifier(record: any): Verifier {
    const credentials = this.parseJson<{
      publicKey?: string
      certificateUrl?: string
      verified?: boolean
    }>(record.credentials, { verified: false })

    return {
      id: record.id,
      type: record.type as VerifierType,
      name: record.name,
      description: record.description,
      credentials: {
        publicKey: credentials.publicKey,
        certificateUrl: credentials.certificateUrl,
        verified: credentials.verified || false,
      },
      reputation: {
        score: record.reputationScore,
        level: record.reputationLevel as ReputationLevel,
        totalVerifications: record.totalVerifications,
      },
      stats: {
        totalVerifications: record.totalVerifications,
        passedCount: record.passedCount,
        failedCount: record.failedCount,
        partialCount: record.partialCount,
      },
      status: record.status as VerifierStatus,
      createdAt: record.createdAt?.toISOString?.() || record.createdAt,
    }
  }
}

// 导出单例
export const verifierService = new VerifierService()