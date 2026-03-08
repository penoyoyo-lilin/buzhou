import { describe, it, expect } from 'vitest'
import {
  cn,
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  sleep,
  safeJsonParse,
  removeEmpty,
} from '@/lib/utils'

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
    })

    it('should merge tailwind classes correctly', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4')
    })
  })

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = '2026-03-07T10:00:00Z'
      const formatted = formatDate(date, 'zh-CN')
      expect(formatted).toContain('2026')
      expect(formatted).toContain('03')
      expect(formatted).toContain('07')
    })

    it('should handle Date object', () => {
      const date = new Date('2026-03-07T10:00:00Z')
      const formatted = formatDate(date, 'zh-CN')
      expect(formatted).toContain('2026')
    })
  })

  describe('formatDateTime', () => {
    it('should format date and time correctly', () => {
      const date = '2026-03-07T10:30:00Z'
      const formatted = formatDateTime(date, 'zh-CN')
      expect(formatted).toContain('2026')
      expect(formatted).toContain('03')
      expect(formatted).toContain('30')
    })
  })

  describe('formatRelativeTime', () => {
    it('should return "刚刚" for recent times', () => {
      const now = new Date()
      expect(formatRelativeTime(now)).toBe('刚刚')
    })

    it('should return minutes ago', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000)
      expect(formatRelativeTime(date)).toBe('5 分钟前')
    })

    it('should return hours ago', () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000)
      expect(formatRelativeTime(date)).toBe('3 小时前')
    })

    it('should return days ago', () => {
      const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      expect(formatRelativeTime(date)).toBe('2 天前')
    })
  })

  describe('formatNumber', () => {
    it('should format thousands', () => {
      expect(formatNumber(1500)).toBe('1.5K')
    })

    it('should format millions', () => {
      expect(formatNumber(1500000)).toBe('1.5M')
    })

    it('should return number as string for small values', () => {
      expect(formatNumber(500)).toBe('500')
    })
  })

  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now()
      await sleep(100)
      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(90)
    })
  })

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"foo":"bar"}', {})
      expect(result).toEqual({ foo: 'bar' })
    })

    it('should return fallback for invalid JSON', () => {
      const fallback = { default: true }
      const result = safeJsonParse('invalid json', fallback)
      expect(result).toEqual(fallback)
    })
  })

  describe('removeEmpty', () => {
    it('should remove undefined and null values', () => {
      const obj = { a: 1, b: null, c: undefined, d: 'test' }
      const result = removeEmpty(obj)
      expect(result).toEqual({ a: 1, d: 'test' })
    })

    it('should keep falsy values that are not null/undefined', () => {
      const obj = { a: 0, b: '', c: false }
      const result = removeEmpty(obj)
      expect(result).toEqual({ a: 0, b: '', c: false })
    })
  })
})