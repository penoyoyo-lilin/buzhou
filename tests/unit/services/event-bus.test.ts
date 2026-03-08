/**
 * EventBus 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { eventBus, DomainEvent } from '@/core/events'

describe('EventBus', () => {
  beforeEach(() => {
    // 清除所有订阅
    eventBus.clear()
  })

  describe('on', () => {
    it('should subscribe to events', () => {
      const handler = vi.fn()
      eventBus.on('article:created', handler)

      // 验证订阅成功（通过 emit 测试）
      expect(handler).not.toHaveBeenCalled()
    })

    it('should return unsubscribe function', async () => {
      const handler = vi.fn()
      const unsubscribe = eventBus.on('article:created', handler)

      // 取消订阅
      unsubscribe()

      // 尝试触发事件
      await eventBus.emit(
        'article:created',
        { test: 'data' },
        { aggregateId: 'test', aggregateType: 'Article', source: 'test' }
      )

      expect(handler).not.toHaveBeenCalled()
    })

    it('should support multiple handlers for same event', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.on('article:created', handler1)
      eventBus.on('article:created', handler2)

      await eventBus.emit(
        'article:created',
        { test: 'data' },
        { aggregateId: 'test', aggregateType: 'Article', source: 'test' }
      )

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })

  describe('emit', () => {
    it('should call registered handlers', async () => {
      const handler = vi.fn()
      eventBus.on('article:created', handler)

      const payload = { articleId: 'art_123', domain: 'agent' as const, createdBy: 'user', status: 'draft' }

      await eventBus.emit(
        'article:created',
        payload,
        { aggregateId: 'art_123', aggregateType: 'Article', source: 'content-pipeline' }
      )

      expect(handler).toHaveBeenCalledTimes(1)
      const event = handler.mock.calls[0][0] as DomainEvent
      expect(event.type).toBe('article:created')
      expect(event.payload).toEqual(payload)
    })

    it('should include correct event metadata', async () => {
      const handler = vi.fn()
      eventBus.on('article:published', handler)

      await eventBus.emit(
        'article:published',
        { articleId: 'art_123', publishedAt: '2024-01-01', publishedBy: 'user' },
        { aggregateId: 'art_123', aggregateType: 'Article', source: 'test-source' }
      )

      const event = handler.mock.calls[0][0] as DomainEvent
      expect(event.id).toBeDefined()
      expect(event.timestamp).toBeDefined()
      expect(event.aggregateId).toBe('art_123')
      expect(event.aggregateType).toBe('Article')
      expect(event.source).toBe('test-source')
    })

    it('should not throw when no handlers registered', async () => {
      // 不应该抛出异常
      await expect(
        eventBus.emit(
          'article:verified',
          { test: 'data' },
          { aggregateId: 'test', aggregateType: 'Article', source: 'test' }
        )
      ).resolves.not.toThrow()
    })

    it('should continue if handler throws error', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error')
      })
      const successHandler = vi.fn()

      eventBus.on('article:created', errorHandler)
      eventBus.on('article:created', successHandler)

      await eventBus.emit(
        'article:created',
        { test: 'data' },
        { aggregateId: 'test', aggregateType: 'Article', source: 'test' }
      )

      // 两个处理器都应该被调用
      expect(errorHandler).toHaveBeenCalled()
      expect(successHandler).toHaveBeenCalled()
    })
  })

  describe('clear', () => {
    it('should remove all subscriptions', async () => {
      const handler = vi.fn()
      eventBus.on('article:created', handler)

      eventBus.clear()

      await eventBus.emit(
        'article:created',
        { test: 'data' },
        { aggregateId: 'test', aggregateType: 'Article', source: 'test' }
      )

      expect(handler).not.toHaveBeenCalled()
    })
  })
})