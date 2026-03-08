import { z } from 'zod'

// ============================================
// 通用校验器
// ============================================

export const idSchema = z.string().min(1, 'ID 不能为空')

export const emailSchema = z
  .string()
  .min(1, '邮箱不能为空')
  .regex(/^[^\s@]+@[^\s@]+$/, '邮箱格式不正确')

export const passwordSchema = z
  .string()
  .min(8, '密码至少 8 个字符')
  .max(100, '密码最多 100 个字符')

export const slugSchema = z
  .string()
  .min(1, 'Slug 不能为空')
  .max(200, 'Slug 最多 200 个字符')
  .regex(/^[a-z0-9-]+$/, 'Slug 只能包含小写字母、数字和连字符')

// ============================================
// 分页校验器
// ============================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// ============================================
// 文章校验器
// ============================================

export const localizedStringSchema = z.object({
  zh: z.string().min(1, '中文内容不能为空'),
  en: z.string().min(1, '英文内容不能为空'),
})

export const articleDomainSchema = z.enum([
  // 原有领域分类
  'agent', 'mcp', 'skill',
  // MVP 内容分类
  'foundation', 'transport',
  'tools_filesystem', 'tools_postgres', 'tools_github',
  'error_codes', 'scenarios',
])

export const articleStatusSchema = z.enum(['draft', 'published', 'archived', 'deprecated'])

export const verificationStatusSchema = z.enum([
  'verified',
  'partial',
  'pending',
  'failed',
  'deprecated',
])

export const articleQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: articleStatusSchema.optional(),
  domain: articleDomainSchema.optional(),
  verificationStatus: verificationStatusSchema.optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export const createArticleSchema = z.object({
  slug: slugSchema,
  title: localizedStringSchema,
  summary: localizedStringSchema,
  content: localizedStringSchema,
  domain: articleDomainSchema,
  tags: z.array(z.string()).default([]),
  codeBlocks: z.array(z.any()).default([]),
  metadata: z.any().optional(),
  qaPairs: z.array(z.any()).default([]),
  relatedIds: z.array(z.string()).default([]),
})

export const updateArticleSchema = createArticleSchema.partial()

// ============================================
// 验证人校验器
// ============================================

export const verifierTypeSchema = z.enum(['official_bot', 'third_party_agent', 'human_expert'])

export const verifierStatusSchema = z.enum(['active', 'suspended', 'retired'])

export const verifierQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  type: verifierTypeSchema.optional(),
  status: verifierStatusSchema.optional(),
})

export const updateVerifierSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: verifierStatusSchema.optional(),
})

// ============================================
// Agent 校验器
// ============================================

export const agentStatusSchema = z.enum(['active', 'suspended', 'revoked'])

export const agentQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  status: agentStatusSchema.optional(),
})

export const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: agentStatusSchema.optional(),
  dailyLimit: z.number().int().min(0).optional(),
  monthlyLimit: z.number().int().min(0).optional(),
})

// ============================================
// 认证校验器
// ============================================

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '密码不能为空'),
})

// ============================================
// 统计校验器
// ============================================

export const dateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})