import { describe, it, expect } from 'vitest'
import {
  idSchema,
  emailSchema,
  passwordSchema,
  slugSchema,
  paginationSchema,
  articleDomainSchema,
  articleStatusSchema,
  verificationStatusSchema,
  loginSchema,
} from '@/lib/validators'

describe('validators', () => {
  describe('idSchema', () => {
    it('should accept valid IDs', () => {
      expect(() => idSchema.parse('abc123')).not.toThrow()
      expect(() => idSchema.parse('art_abc123')).not.toThrow()
    })

    it('should reject empty IDs', () => {
      expect(() => idSchema.parse('')).toThrow()
    })
  })

  describe('emailSchema', () => {
    it('should accept valid emails', () => {
      expect(() => emailSchema.parse('test@example.com')).not.toThrow()
      expect(() => emailSchema.parse('user.name@domain.co')).not.toThrow()
    })

    it('should reject invalid emails', () => {
      expect(() => emailSchema.parse('invalid')).toThrow()
      expect(() => emailSchema.parse('@example.com')).toThrow()
      expect(() => emailSchema.parse('test@')).toThrow()
    })
  })

  describe('passwordSchema', () => {
    it('should accept valid passwords', () => {
      expect(() => passwordSchema.parse('password123')).not.toThrow()
      expect(() => passwordSchema.parse('a'.repeat(8))).not.toThrow()
    })

    it('should reject short passwords', () => {
      expect(() => passwordSchema.parse('short')).toThrow()
    })

    it('should reject too long passwords', () => {
      expect(() => passwordSchema.parse('a'.repeat(101))).toThrow()
    })
  })

  describe('slugSchema', () => {
    it('should accept valid slugs', () => {
      expect(() => slugSchema.parse('my-article')).not.toThrow()
      expect(() => slugSchema.parse('article-123')).not.toThrow()
      expect(() => slugSchema.parse('test')).not.toThrow()
    })

    it('should reject invalid slugs', () => {
      expect(() => slugSchema.parse('My Article')).toThrow()
      expect(() => slugSchema.parse('article_123')).toThrow()
      expect(() => slugSchema.parse('')).toThrow()
    })
  })

  describe('paginationSchema', () => {
    it('should use default values', () => {
      const result = paginationSchema.parse({})
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
    })

    it('should parse string numbers', () => {
      const result = paginationSchema.parse({ page: '2', pageSize: '10' })
      expect(result.page).toBe(2)
      expect(result.pageSize).toBe(10)
    })

    it('should reject invalid page numbers', () => {
      expect(() => paginationSchema.parse({ page: 0 })).toThrow()
      expect(() => paginationSchema.parse({ page: -1 })).toThrow()
    })

    it('should limit pageSize', () => {
      expect(() => paginationSchema.parse({ pageSize: 101 })).toThrow()
      expect(() => paginationSchema.parse({ pageSize: 0 })).toThrow()
    })
  })

  describe('articleDomainSchema', () => {
    it('should accept valid domains', () => {
      expect(articleDomainSchema.parse('agent')).toBe('agent')
      expect(articleDomainSchema.parse('mcp')).toBe('mcp')
      expect(articleDomainSchema.parse('skill')).toBe('skill')
    })

    it('should reject invalid domains', () => {
      expect(() => articleDomainSchema.parse('invalid')).toThrow()
    })
  })

  describe('articleStatusSchema', () => {
    it('should accept valid statuses', () => {
      expect(articleStatusSchema.parse('draft')).toBe('draft')
      expect(articleStatusSchema.parse('published')).toBe('published')
      expect(articleStatusSchema.parse('archived')).toBe('archived')
      expect(articleStatusSchema.parse('deprecated')).toBe('deprecated')
    })
  })

  describe('verificationStatusSchema', () => {
    it('should accept valid verification statuses', () => {
      expect(verificationStatusSchema.parse('verified')).toBe('verified')
      expect(verificationStatusSchema.parse('partial')).toBe('partial')
      expect(verificationStatusSchema.parse('pending')).toBe('pending')
      expect(verificationStatusSchema.parse('failed')).toBe('failed')
      expect(verificationStatusSchema.parse('deprecated')).toBe('deprecated')
    })
  })

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      expect(() => loginSchema.parse({ email: 'test@example.com', password: 'password123' })).not.toThrow()
    })

    it('should reject invalid login data', () => {
      expect(() => loginSchema.parse({ email: 'invalid', password: 'password123' })).toThrow()
      expect(() => loginSchema.parse({ email: 'test@example.com', password: '' })).toThrow()
    })
  })
})