import { describe, it, expect } from 'vitest'
import {
  idSchema,
  emailSchema,
  passwordSchema,
  slugSchema,
  paginationSchema,
  localizedStringSchema,
  articleDomainSchema,
  articleStatusSchema,
  verificationStatusSchema,
  articleQuerySchema,
  createArticleSchema,
  updateArticleSchema,
  verifierTypeSchema,
  verifierStatusSchema,
  verifierQuerySchema,
  updateVerifierSchema,
  agentStatusSchema,
  agentQuerySchema,
  updateAgentSchema,
  loginSchema,
  dateRangeSchema,
} from '@/lib/validators'

describe('Validators', () => {
  describe('idSchema', () => {
    it('should accept non-empty string', () => {
      const result = idSchema.safeParse('abc123')
      expect(result.success).toBe(true)
    })

    it('should reject empty string', () => {
      const result = idSchema.safeParse('')
      expect(result.success).toBe(false)
    })
  })

  describe('emailSchema', () => {
    it('should accept valid email', () => {
      const result = emailSchema.safeParse('test@example.com')
      expect(result.success).toBe(true)
    })

    it('should reject invalid email', () => {
      const result = emailSchema.safeParse('invalid-email')
      expect(result.success).toBe(false)
    })
  })

  describe('passwordSchema', () => {
    it('should accept password with 8+ characters', () => {
      const result = passwordSchema.safeParse('password123')
      expect(result.success).toBe(true)
    })

    it('should reject password less than 8 characters', () => {
      const result = passwordSchema.safeParse('pass')
      expect(result.success).toBe(false)
    })

    it('should reject password more than 100 characters', () => {
      const result = passwordSchema.safeParse('a'.repeat(101))
      expect(result.success).toBe(false)
    })
  })

  describe('slugSchema', () => {
    it('should accept valid slug', () => {
      const result = slugSchema.safeParse('my-article-slug')
      expect(result.success).toBe(true)
    })

    it('should accept slug with numbers', () => {
      const result = slugSchema.safeParse('article-123')
      expect(result.success).toBe(true)
    })

    it('should reject slug with uppercase letters', () => {
      const result = slugSchema.safeParse('My-Article')
      expect(result.success).toBe(false)
    })

    it('should reject slug with special characters', () => {
      const result = slugSchema.safeParse('article@slug')
      expect(result.success).toBe(false)
    })
  })

  describe('paginationSchema', () => {
    it('should use default values', () => {
      const result = paginationSchema.parse({})
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
    })

    it('should accept custom values', () => {
      const result = paginationSchema.parse({ page: 2, pageSize: 50 })
      expect(result.page).toBe(2)
      expect(result.pageSize).toBe(50)
    })

    it('should coerce string numbers', () => {
      const result = paginationSchema.parse({ page: '3', pageSize: '10' })
      expect(result.page).toBe(3)
      expect(result.pageSize).toBe(10)
    })

    it('should reject pageSize > 100', () => {
      const result = paginationSchema.safeParse({ pageSize: 200 })
      expect(result.success).toBe(false)
    })
  })

  describe('localizedStringSchema', () => {
    it('should accept valid localized string', () => {
      const result = localizedStringSchema.safeParse({
        zh: '中文标题',
        en: 'English Title',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing zh', () => {
      const result = localizedStringSchema.safeParse({
        en: 'English Title',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing en', () => {
      const result = localizedStringSchema.safeParse({
        zh: '中文标题',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('articleDomainSchema', () => {
    it('should accept valid domains', () => {
      expect(articleDomainSchema.safeParse('agent').success).toBe(true)
      expect(articleDomainSchema.safeParse('mcp').success).toBe(true)
      expect(articleDomainSchema.safeParse('skill').success).toBe(true)
    })

    it('should reject invalid domain', () => {
      const result = articleDomainSchema.safeParse('invalid')
      expect(result.success).toBe(false)
    })
  })

  describe('articleStatusSchema', () => {
    it('should accept valid statuses', () => {
      expect(articleStatusSchema.safeParse('draft').success).toBe(true)
      expect(articleStatusSchema.safeParse('published').success).toBe(true)
      expect(articleStatusSchema.safeParse('archived').success).toBe(true)
      expect(articleStatusSchema.safeParse('deprecated').success).toBe(true)
    })
  })

  describe('verificationStatusSchema', () => {
    it('should accept valid verification statuses', () => {
      expect(verificationStatusSchema.safeParse('verified').success).toBe(true)
      expect(verificationStatusSchema.safeParse('partial').success).toBe(true)
      expect(verificationStatusSchema.safeParse('pending').success).toBe(true)
      expect(verificationStatusSchema.safeParse('failed').success).toBe(true)
      expect(verificationStatusSchema.safeParse('deprecated').success).toBe(true)
    })
  })

  describe('articleQuerySchema', () => {
    it('should use default sort values', () => {
      const result = articleQuerySchema.parse({})
      expect(result.sortBy).toBe('createdAt')
      expect(result.sortOrder).toBe('desc')
    })

    it('should accept valid query params', () => {
      const result = articleQuerySchema.safeParse({
        search: 'test',
        status: 'published',
        domain: 'agent',
        page: 1,
        pageSize: 20,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('createArticleSchema', () => {
    it('should accept valid article data', () => {
      const result = createArticleSchema.safeParse({
        slug: 'test-article',
        title: { zh: '测试文章', en: 'Test Article' },
        summary: { zh: '摘要', en: 'Summary' },
        content: { zh: '内容', en: 'Content' },
        domain: 'agent',
      })
      expect(result.success).toBe(true)
    })

    it('should use default values for optional fields', () => {
      const result = createArticleSchema.parse({
        slug: 'test-article',
        title: { zh: '测试文章', en: 'Test Article' },
        summary: { zh: '摘要', en: 'Summary' },
        content: { zh: '内容', en: 'Content' },
        domain: 'agent',
      })
      expect(result.tags).toEqual([])
      expect(result.codeBlocks).toEqual([])
      expect(result.qaPairs).toEqual([])
      expect(result.relatedIds).toEqual([])
    })
  })

  describe('updateArticleSchema', () => {
    it('should accept partial data', () => {
      const result = updateArticleSchema.safeParse({
        title: { zh: '新标题', en: 'New Title' },
      })
      expect(result.success).toBe(true)
    })
  })

  describe('verifierTypeSchema', () => {
    it('should accept valid verifier types', () => {
      expect(verifierTypeSchema.safeParse('official_bot').success).toBe(true)
      expect(verifierTypeSchema.safeParse('third_party_agent').success).toBe(true)
      expect(verifierTypeSchema.safeParse('human_expert').success).toBe(true)
    })
  })

  describe('verifierStatusSchema', () => {
    it('should accept valid verifier statuses', () => {
      expect(verifierStatusSchema.safeParse('active').success).toBe(true)
      expect(verifierStatusSchema.safeParse('suspended').success).toBe(true)
      expect(verifierStatusSchema.safeParse('retired').success).toBe(true)
    })
  })

  describe('updateVerifierSchema', () => {
    it('should accept partial data', () => {
      const result = updateVerifierSchema.safeParse({
        name: 'New Name',
        status: 'suspended',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('agentStatusSchema', () => {
    it('should accept valid agent statuses', () => {
      expect(agentStatusSchema.safeParse('active').success).toBe(true)
      expect(agentStatusSchema.safeParse('suspended').success).toBe(true)
      expect(agentStatusSchema.safeParse('revoked').success).toBe(true)
    })
  })

  describe('updateAgentSchema', () => {
    it('should accept valid limits', () => {
      const result = updateAgentSchema.safeParse({
        dailyLimit: 1000,
        monthlyLimit: 30000,
      })
      expect(result.success).toBe(true)
    })

    it('should reject negative limits', () => {
      const result = updateAgentSchema.safeParse({
        dailyLimit: -100,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('loginSchema', () => {
    it('should accept valid login data', () => {
      const result = loginSchema.safeParse({
        email: 'admin@example.com',
        password: 'password123',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'admin@example.com',
        password: '',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid email', () => {
      const result = loginSchema.safeParse({
        email: 'invalid-email',
        password: 'password123',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('dateRangeSchema', () => {
    it('should accept valid datetime strings', () => {
      const result = dateRangeSchema.safeParse({
        from: '2024-01-01T00:00:00Z',
        to: '2024-12-31T23:59:59Z',
      })
      expect(result.success).toBe(true)
    })

    it('should accept empty object', () => {
      const result = dateRangeSchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })
})