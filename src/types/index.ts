// ============================================
// 核心实体类型
// ============================================

/**
 * 多语言字符串
 */
export interface LocalizedString {
  zh: string
  en: string
}

/**
 * 文章分类
 * 注意：统一使用下划线格式，和公开 API / Prisma 枚举约定保持一致
 */
export type ArticleDomain =
  // 基础领域分类
  | 'agent' | 'mcp' | 'skill'
  // MVP 内容分类
  | 'foundation' | 'transport'
  | 'tools_filesystem' | 'tools_postgres' | 'tools_github'
  | 'error_codes' | 'scenarios'

/**
 * 文章优先级
 */
export type ArticlePriority = 'P0' | 'P1'

/**
 * 文章状态
 */
export type ArticleStatus = 'draft' | 'published' | 'archived' | 'deprecated'

/**
 * 验证状态
 */
export type VerificationStatus = 'verified' | 'partial' | 'pending' | 'failed' | 'deprecated'

/**
 * 风险等级
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

/**
 * 验证人类型
 */
export type VerifierType = 'official_bot' | 'third_party_agent' | 'human_expert'

/**
 * 验证人状态
 */
export type VerifierStatus = 'active' | 'suspended' | 'retired'

/**
 * Agent 状态
 */
export type AgentStatus = 'active' | 'suspended' | 'revoked'

/**
 * 管理员角色
 */
export type AdminRole = 'super_admin' | 'admin' | 'editor' | 'viewer'

/**
 * 管理员状态
 */
export type AdminStatus = 'active' | 'suspended' | 'deleted'

// ============================================
// 文章相关类型
// ============================================

export interface CodeBlock {
  id: string
  language: string
  filename: string | null
  content: string
  description: LocalizedString
}

export interface RuntimeEnv {
  name: string
  version: string
}

export interface ArticleMetadata {
  applicableVersions: string[]
  confidenceScore: number
  riskLevel: RiskLevel
  runtimeEnv: RuntimeEnv[]
}

export interface QAPair {
  id: string
  question: LocalizedString
  answer: LocalizedString
}

export interface VerificationRecord {
  id: string
  articleId: string
  verifier: VerifierRef
  result: 'passed' | 'failed' | 'partial'
  environment: {
    os: string
    runtime: string
    version: string
  }
  notes: string | null
  verifiedAt: string
}

export interface VerifierRef {
  id: number
  type: VerifierType
  name: string
}

export interface Article {
  id: string
  slug: string
  title: LocalizedString
  summary: LocalizedString
  content: LocalizedString
  domain: ArticleDomain
  tags: string[]
  keywords: string[] // 关键词，用于辅助决策，3-8个
  priority: ArticlePriority // 优先级：P0 | P1
  codeBlocks: CodeBlock[]
  metadata: ArticleMetadata
  qaPairs: QAPair[]
  relatedIds: string[]
  verificationStatus: VerificationStatus
  verificationRecords: VerificationRecord[]
  status: ArticleStatus
  createdBy: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

// ============================================
// 验证人相关类型
// ============================================

export interface VerifierCredentials {
  publicKey?: string
  certificateUrl?: string
  verified: boolean
}

export type ReputationLevel = 'beginner' | 'intermediate' | 'expert' | 'master'

export interface VerifierReputation {
  score: number
  level: ReputationLevel
  totalVerifications: number
  successfulRate: number
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
  credentials: VerifierCredentials
  reputation: VerifierReputation
  stats: VerifierStats
  status: VerifierStatus
  createdAt: string
}

// ============================================
// Agent 相关类型
// ============================================

export interface ApiKeyInfo {
  keyHash: string
  prefix: string
  createdAt: string
  expiresAt: string | null
}

export interface AgentQuota {
  dailyLimit: number
  monthlyLimit: number
  usedToday: number
  usedThisMonth: number
}

export interface AgentStats {
  totalRequests: number
  successRequests: number
  failedRequests: number
  avgResponseTime: number
}

export interface AgentApp {
  id: string
  name: string
  description: string
  owner: string
  apiKey: ApiKeyInfo
  quota: AgentQuota
  stats: AgentStats
  status: AgentStatus
  createdAt: string
  lastAccessAt: string | null
}

// ============================================
// 管理员相关类型
// ============================================

export interface Admin {
  id: string
  email: string
  name: string
  role: AdminRole
  status: AdminStatus
  lastLoginAt: string | null
  createdAt: string
}

export interface Session {
  id: string
  adminId: string
  token: string
  expiresAt: string
  createdAt: string
}

// ============================================
// 权限类型
// ============================================

export type Permission =
  | 'article:read'
  | 'article:write'
  | 'article:delete'
  | 'verifier:read'
  | 'verifier:write'
  | 'agent:read'
  | 'agent:write'
  | 'stats:read'

// ============================================
// API 响应类型
// ============================================

export interface ApiError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface ResponseMeta {
  requestId: string
  timestamp: string
  nextStep?: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: ApiError | null
  meta: ResponseMeta
}

// ============================================
// 分页类型
// ============================================

export interface Pagination {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: Pagination
}

// ============================================
// 审计日志类型
// ============================================

export interface AuditLog {
  id: string
  adminId: string
  action: string
  entityType: string
  entityId: string
  changes: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}
