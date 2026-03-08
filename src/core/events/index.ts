import { nanoid } from 'nanoid'
import type { ArticleDomain } from '@/types'

// ============================================
// 事件类型定义
// ============================================

export type EventType =
  | 'article:created'
  | 'article:updated'
  | 'article:published'
  | 'article:verified'
  | 'article:deprecated'
  | 'verifier:registered'
  | 'verifier:reputation-changed'
  | 'render:cache-miss'
  | 'render:completed'

export interface DomainEvent<T = unknown> {
  id: string
  type: EventType
  aggregateId: string
  aggregateType: string
  payload: T
  timestamp: string
  source: string
}

export type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void> | void

// ============================================
// 事件总线实现
// ============================================

type HandlerMap = Map<string, Set<EventHandler>>

class EventBus {
  private handlers: HandlerMap = new Map()

  /**
   * 订阅事件
   */
  on<T = unknown>(eventType: EventType, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    this.handlers.get(eventType)!.add(handler as EventHandler)

    // 返回取消订阅函数
    return () => {
      this.handlers.get(eventType)?.delete(handler as EventHandler)
    }
  }

  /**
   * 发布事件
   */
  async emit<T = unknown>(
    type: EventType,
    payload: T,
    options: {
      aggregateId: string
      aggregateType: string
      source: string
    }
  ): Promise<void> {
    const event: DomainEvent<T> = {
      id: nanoid(),
      type,
      aggregateId: options.aggregateId,
      aggregateType: options.aggregateType,
      payload,
      timestamp: new Date().toISOString(),
      source: options.source,
    }

    const handlers = this.handlers.get(type)
    if (!handlers || handlers.size === 0) {
      return
    }

    // 异步执行所有处理器，捕获同步和异步错误
    await Promise.allSettled(
      Array.from(handlers).map(async handler => {
        try {
          await handler(event)
        } catch {
          // 忽略错误，继续执行其他处理器
        }
      })
    )
  }

  /**
   * 清除所有订阅
   */
  clear(): void {
    this.handlers.clear()
  }
}

// 单例导出
export const eventBus = new EventBus()

// ============================================
// 事件载荷类型
// ============================================

export interface ArticleCreatedPayload {
  articleId: string
  domain: ArticleDomain
  createdBy: string
  status: string
}

export interface ArticlePublishedPayload {
  articleId: string
  publishedAt: string
  publishedBy: string
}

export interface ArticleVerifiedPayload {
  articleId: string
  verificationId: string
  result: 'passed' | 'failed' | 'partial'
  verifierId: number
  environment: {
    os: string
    runtime: string
    version: string
  }
}

export interface ArticleUpdatedPayload {
  articleId: string
  updatedBy: string
  changes: string[]
}

export interface VerifierRegisteredPayload {
  verifierId: number
  type: 'official_bot' | 'third_party_agent' | 'human_expert'
  name: string
}
