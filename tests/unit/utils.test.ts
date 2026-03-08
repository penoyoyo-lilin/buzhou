import { describe, it, expect } from 'vitest'
import { cn, formatDate, formatDateTime, formatRelativeTime, formatNumber, safeJsonParse, removeEmpty } from '@/lib/utils'

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      const result = cn('foo', 'bar')
      expect(result).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
      const result = cn('base', true && 'included', false && 'excluded')
      expect(result).toBe('base included')
    })

    it('should merge tailwind classes correctly', () => {
      const result = cn('px-2 py-1', 'px-4')
      expect(result).toBe('py-1 px-4')
    })
  })

  describe('formatDate', () => {
    it('should format date string', () => {
      const result = formatDate('2024-01-15T10:30:00Z')
      expect(result).toMatch(/2024/)
    })

    it('should format Date object', () => {
      const result = formatDate(new Date('2024-06-20'))
      expect(result).toMatch(/2024/)
    })
  })

  describe('formatDateTime', () => {
    it('should format date and time', () => {
      const result = formatDateTime('2024-01-15T10:30:00Z')
      expect(result).toMatch(/2024/)
    })
  })

  describe('formatRelativeTime', () => {
    it('should return "刚刚" for recent time', () => {
      const result = formatRelativeTime(new Date())
      expect(result).toBe('刚刚')
    })

    it('should return minutes ago', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000)
      const result = formatRelativeTime(date)
      expect(result).toBe('5 分钟前')
    })

    it('should return hours ago', () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000)
      const result = formatRelativeTime(date)
      expect(result).toBe('3 小时前')
    })

    it('should return days ago', () => {
      const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      const result = formatRelativeTime(date)
      expect(result).toBe('2 天前')
    })

    it('should return formatted date for old dates', () => {
      const date = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      const result = formatRelativeTime(date)
      expect(result).toMatch(/2024|2025|2026/)
    })
  })

  describe('formatNumber', () => {
    it('should format small numbers as is', () => {
      expect(formatNumber(100)).toBe('100')
      expect(formatNumber(999)).toBe('999')
    })

    it('should format thousands with K', () => {
      expect(formatNumber(1000)).toBe('1.0K')
      expect(formatNumber(15000)).toBe('15.0K')
    })

    it('should format millions with M', () => {
      expect(formatNumber(1000000)).toBe('1.0M')
      expect(formatNumber(2500000)).toBe('2.5M')
    })
  })

  describe('safeJsonParse', () => {
    it('should parse valid JSON', () => {
      const result = safeJsonParse('{"name":"test"}', {})
      expect(result).toEqual({ name: 'test' })
    })

    it('should return fallback for invalid JSON', () => {
      const result = safeJsonParse('invalid json', { default: true })
      expect(result).toEqual({ default: true })
    })
  })

  describe('removeEmpty', () => {
    it('should remove null and undefined values', () => {
      const result = removeEmpty({
        a: 1,
        b: null,
        c: undefined,
        d: 'test',
      })
      expect(result).toEqual({ a: 1, d: 'test' })
    })

    it('should keep falsy values like 0 and empty string', () => {
      const result = removeEmpty({
        a: 0,
        b: '',
        c: null,
      })
      expect(result).toEqual({ a: 0, b: '' })
    })
  })
})