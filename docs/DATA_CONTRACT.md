# 数据契约文档 (Data Contract)

> 本文档定义系统中所有实体、API 格式和事件契约，是所有模块的"宪法"。

---

## 1. 核心实体定义

### 1.1 Article（文章）

```typescript
interface Article {
  // 基础标识
  id: string;                    // 唯一标识，格式: art_<nanoid>
  slug: string;                  // URL友好标识

  // 多语言内容
  title: LocalizedString;        // 标题
  summary: LocalizedString;      // 摘要
  content: LocalizedString;      // 正文 (Markdown)

  // 分类与标签
  domain: ArticleDomain;         // 领域分类
  tags: string[];                // 关键词标签
  priority: ArticlePriority;     // 优先级：P0 | P1

  // 代码块
  codeBlocks: CodeBlock[];       // 代码块集合

  // 元数据
  metadata: ArticleMetadata;     // 元数据

  // 决策辅助
  qaPairs: QAPair[];             // QA问答对
  relatedIds: string[];          // 关联文章ID
  keywords: string[];          // 文章关键词

  // 验证信息
  verificationStatus: VerificationStatus;
  verificationRecords: VerificationRecord[];

  // 系统字段
  createdBy: string;             // 创建者ID
  createdAt: ISODateString;
  updatedAt: ISODateString;
  publishedAt: ISODateString | null;
  status: ArticleStatus;
}

// 支持类型
interface LocalizedString {
  zh: string;
  en: string;
}

type ArticleDomain =
  // 原有领域分类
  | 'agent' | 'mcp' | 'skill'
  // MVP 内容分类
  | 'foundation' | 'transport'
  | 'tools-filesystem' | 'tools-postgres' | 'tools-github'
  | 'error-codes' | 'scenarios';

type ArticlePriority = 'P0' | 'P1';

interface CodeBlock {
  id: string;                    // 代码块ID
  language: string;              // 编程语言
  filename: string | null;       // 文件名
  content: string;               // 代码内容
  description: LocalizedString;  // 说明
}

interface ArticleMetadata {
  applicableVersions: string[];  // 适用版本
  confidenceScore: number;       // 置信分数 (0-100)
  riskLevel: RiskLevel;          // 风险等级
  runtimeEnv: RuntimeEnv[];      // 运行环境依赖
}

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface RuntimeEnv {
  name: string;                  // 环境名称
  version: string;               // 版本要求
}

interface QAPair {
  id: string;
  question: LocalizedString;
  answer: LocalizedString;
}

type VerificationStatus = 'verified' | 'partial' | 'pending' | 'failed' | 'deprecated';

type ArticleStatus = 'draft' | 'published' | 'archived' | 'deprecated';
```

### 1.2 VerificationRecord（验证记录）

```typescript
interface VerificationRecord {
  id: string;                    // 验证记录ID
  articleId: string;             // 关联文章ID

  verifier: VerifierRef;         // 验证人引用
  result: VerificationResult;    // 验证结果
  environment: VerificationEnv;  // 验证环境

  notes: string | null;          // 验证备注
  verifiedAt: ISODateString;     // 验证时间
}

interface VerifierRef {
  id: string;                    // 验证人ID
  type: VerifierType;
  name: string;                  // 显示名称
}

type VerifierType = 'official_bot' | 'third_party_agent' | 'human_expert';

type VerificationResult = 'passed' | 'failed' | 'partial';

interface VerificationEnv {
  os: string;                    // 操作系统
  runtime: string;               // 运行时
  version: string;               // 版本
}
```

### 1.3 Verifier（验证人）

```typescript
interface Verifier {
  id: string;                    // 验证人ID
  type: VerifierType;
  name: string;
  description: string;

  // 认证信息
  credentials: VerifierCredentials;

  // 信誉系统
  reputation: VerifierReputation;

  // 统计
  stats: VerifierStats;

  status: VerifierStatus;
  createdAt: ISODateString;
}

interface VerifierCredentials {
  publicKey?: string;            // Agent公钥
  certificateUrl?: string;       // 证书链接
  verified: boolean;             // 是否已认证
}

interface VerifierReputation {
  score: number;                 // 信誉分 (0-100)
  level: ReputationLevel;
  totalVerifications: number;
  successfulRate: number;        // 成功率
}

type ReputationLevel = 'beginner' | 'intermediate' | 'expert' | 'master';

interface VerifierStats {
  totalVerifications: number;
  passedCount: number;
  failedCount: number;
  partialCount: number;
}

type VerifierStatus = 'active' | 'suspended' | 'retired';
```

### 1.4 AgentApp（Agent应用）

```typescript
interface AgentApp {
  id: string;                    // 应用ID
  name: string;                  // 应用名称
  description: string;
  owner: string;                 // 所有者ID

  // API配置
  apiKey: ApiKeyInfo;

  // 额度配置
  quota: AgentQuota;

  // 统计
  stats: AgentStats;

  status: AgentStatus;
  createdAt: ISODateString;
  lastAccessAt: ISODateString | null;
}

interface ApiKeyInfo {
  keyHash: string;               // API Key哈希值
  prefix: string;                // Key前缀 (用于识别)
  createdAt: ISODateString;
  expiresAt: ISODateString | null;
}

interface AgentQuota {
  dailyLimit: number;            // 日限额
  monthlyLimit: number;          // 月限额
  usedToday: number;
  usedThisMonth: number;
}

interface AgentStats {
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  avgResponseTime: number;
}

type AgentStatus = 'active' | 'suspended' | 'revoked';
```

### 1.5 User（用户 - 二期扩展）

```typescript
interface User {
  id: string;
  type: UserType;
  email: string | null;
  walletAddress: string | null;

  // 积分账户
  balance: number;

  status: UserStatus;
  createdAt: ISODateString;
}

type UserType = 'human' | 'agent';

type UserStatus = 'active' | 'suspended' | 'deleted';
```

---

## 2. API 格式定义

### 2.1 通用响应结构

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
  meta: ResponseMeta;
}

interface ApiError {
  code: string;                  // 错误码
  message: string;               // 错误信息
  details?: Record<string, any>; // 详细信息
}

interface ResponseMeta {
  requestId: string;             // 请求ID
  timestamp: ISODateString;
  nextStep?: string;             // Agent下一步建议
}
```

### 2.2 Resolve API（智能解析接口，暂不提供）

**请求**：
```typescript
// GET /v1/resolve
interface ResolveRequest {
  query: string;                 // 搜索查询
  lang?: 'zh' | 'en';           // 语言偏好
  domain?: ArticleDomain;        // 领域过滤
}

// 或通过ID精确查询
// GET /v1/resolve?id=art_xxx
interface ResolveByIdRequest {
  id: string;                    // 文章ID
  lang?: 'zh' | 'en';
}
```

**响应**：
```typescript
interface ResolveResponse extends ApiResponse<ArticleResponse> {}

interface ArticleResponse {
  // 核心内容
  id: string;
  title: string;
  summary: string;
  content: string;               // Markdown正文
  codeBlocks: CodeBlockResponse[];

  // 元数据
  tags: string[];
  domain: ArticleDomain;
  metadata: ArticleMetadata;

  // 验证信息
  verificationStatus: VerificationStatus;
  latestVerification: VerificationRecord | null;

  // 决策辅助
  qaPairs: QAPairResponse[];
  relatedArticles: RelatedArticle[];

  // API引导
  apiEndpoint: string;
}

interface CodeBlockResponse {
  id: string;
  language: string;
  content: string;
  description: string;
}

interface QAPairResponse {
  question: string;
  answer: string;
}

interface RelatedArticle {
  id: string;
  title: string;
  relevanceScore: number;
}
```

### 2.3 Search API（搜索接口）

**请求**：
```typescript
// GET /v1/search
interface SearchRequest {
  query: string;
  page?: number;                 // 默认 1
  pageSize?: number;             // 默认 20, 最大 100
  domain?: ArticleDomain[];
  status?: VerificationStatus[];
  dateFrom?: ISODateString;
  dateTo?: ISODateString;
  sortBy?: 'relevance' | 'date' | 'confidence';
  lang?: 'zh' | 'en';
}
```

**响应**：
```typescript
interface SearchResponse extends ApiResponse<SearchResult> {}

interface SearchResult {
  articles: ArticleSummary[];
  pagination: Pagination;
}

interface ArticleSummary {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  domain: ArticleDomain;
  verificationStatus: VerificationStatus;
  confidenceScore: number;
  updatedAt: ISODateString;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
```

### 2.4 内部写入接口（高权限）

**请求**：
```typescript
// POST /internal/v1/articles
interface CreateArticleRequest {
  title: LocalizedString;
  summary: LocalizedString;
  content: LocalizedString;
  domain: ArticleDomain;
  tags?: string[];
  codeBlocks?: CodeBlock[];
  metadata?: ArticleMetadata;
  qaPairs?: QAPair[];
  relatedIds?: string[];
  createdBy: string;
  skipVerification?: boolean;    // 跳过沙盒验证

  // 新增：验证记录
  verificationRecords?: VerificationRecordInput[];
}

interface VerificationRecordInput {
  verifierId: string;            // 验证人ID
  result: 'passed' | 'failed' | 'partial';
  environment: VerificationEnv;  // 验证环境
  notes?: string;                // 验证备注
}

// 响应
interface CreateArticleResponse extends ApiResponse<Article> {}

// 文章创建后自动触发异步任务：
// - QA 对生成（AI）
// - 关键词生成（AI）
// - 关联文章生成（AI）
```

### 2.5 内部统计接口（高权限）

**请求**：
```typescript
// GET /internal/v1/analytics
interface AnalyticsRequest {
  // 时间范围
  startDate?: ISODateString;      // 开始时间
  endDate?: ISODateString;        // 结束时间，默认当前时间
  // 聚合粒度
  granularity?: 'hour' | 'day' | 'week' | 'month';  // 默认 day
  // 数据类型过滤
  type?: 'overview' | 'traffic' | 'api' | 'articles' | 'all';  // 默认 all
  // 分页（用于详细数据）
  page?: number;                  // 默认 1
  pageSize?: number;              // 默认 20，最大 100
}

// 响应
interface AnalyticsResponse extends ApiResponse<AnalyticsData> {}

interface AnalyticsData {
  overview?: OverviewStats;
  traffic?: TrafficStats;
  api?: ApiStats;
  articles?: ArticleStats;
}

interface OverviewStats {
  articles: { total: number; published: number };
  views: { total: number; inPeriod: number };
  apiRequests: { total: number; inPeriod: number };
  agents: { active: number };
  verifiers: { active: number };
  period: { start: string; end: string };
}

interface TrafficStats {
  total: number;
  humanViews: number;
  botViews: number;
  timeSeries: Array<{ time: string; count: number }>;
  topPages: Array<{ path: string; views: number }>;
  topReferrers: Array<{ referrer: string; views: number }>;
  granularity: string;
}

interface ApiStats {
  total: number;
  success: number;
  errors: number;
  successRate: number;
  avgResponseTime: number;
  timeSeries: Array<{ time: string; count: number }>;
  topEndpoints: Array<{
    endpoint: string;
    requests: number;
    avgResponseTime: number;
    errorRate: number;
  }>;
  agentsWithRequests: number;
  granularity: string;
}

interface ArticleStats {
  byDomain: Array<{ domain: string; count: number }>;
  byVerification: Array<{ status: string; count: number }>;
  newInPeriod: number;
  publishedInPeriod: number;
  topTags: Array<{ tag: string; count: number }>;
}
```

### 2.6 管理后台接口

```typescript
// 文章管理
// GET /admin/articles - 列表
// GET /admin/articles/:id - 详情
// PUT /admin/articles/:id - 更新
// DELETE /admin/articles/:id - 删除
// POST /admin/articles/:id/feature - 置顶
// POST /admin/articles/:id/deprecate - 标记失效

// 验证人管理
// GET /admin/verifiers - 列表
// PUT /admin/verifiers/:id - 更新

// Agent管理
// GET /admin/agents - 列表
// POST /admin/agents/:id/api-key - 生成API Key
// PUT /admin/agents/:id/quota - 更新额度

// 统计
// GET /admin/stats/overview - 总览
// GET /admin/stats/traffic - 流量分析
// GET /admin/stats/api - API统计
```

---

## 3. 事件定义

### 3.1 事件总线规范

```typescript
interface DomainEvent<T> {
  id: string;                    // 事件ID
  type: string;                  // 事件类型
  aggregateId: string;           // 聚合根ID
  aggregateType: string;         // 聚合根类型
  payload: T;                    // 事件载荷
  timestamp: ISODateString;
  source: string;                // 来源模块
}
```

### 3.2 文章事件

```typescript
// 文章已创建
interface ArticleCreatedEvent extends DomainEvent<ArticleCreatedPayload> {}

interface ArticleCreatedPayload {
  articleId: string;
  domain: ArticleDomain;
  createdBy: string;
}

// 文章已发布
interface ArticlePublishedEvent extends DomainEvent<ArticlePublishedPayload> {}

interface ArticlePublishedPayload {
  articleId: string;
  publishedAt: ISODateString;
}

// 文章已验证
interface ArticleVerifiedEvent extends DomainEvent<ArticleVerifiedPayload> {}

interface ArticleVerifiedPayload {
  articleId: string;
  verificationId: string;
  result: VerificationResult;
  verifierId: string;
}

// 文章已标记失效
interface ArticleDeprecatedEvent extends DomainEvent<ArticleDeprecatedPayload> {}

interface ArticleDeprecatedPayload {
  articleId: string;
  reason: string;
  deprecatedBy: string;
}
```

### 3.3 Agent事件

```typescript
// Agent API调用
interface AgentApiCalledEvent extends DomainEvent<AgentApiCalledPayload> {}

interface AgentApiCalledPayload {
  agentId: string;
  endpoint: string;
  requestId: string;
  responseTime: number;
  success: boolean;
}

// Agent额度告警
interface AgentQuotaWarningEvent extends DomainEvent<AgentQuotaWarningPayload> {}

interface AgentQuotaWarningPayload {
  agentId: string;
  quotaType: 'daily' | 'monthly';
  usedPercentage: number;
}
```

### 3.4 二期事件（积分系统）

```typescript
// 积分获取
interface CreditsEarnedEvent extends DomainEvent<CreditsEarnedPayload> {}

interface CreditsEarnedPayload {
  userId: string;
  amount: number;
  reason: 'article_created' | 'article_verified' | 'referral';
  referenceId: string;
}

// 积分消耗
interface CreditsSpentEvent extends DomainEvent<CreditsSpentPayload> {}

interface CreditsSpentPayload {
  userId: string;
  amount: number;
  reason: 'api_call' | 'sandbox_execution' | 'transaction_fee';
  referenceId: string;
}
```

---

## 4. 数据类型别名

```typescript
// ISO 8601 日期字符串
type ISODateString = string;

// 分页参数
interface PageParams {
  page: number;
  pageSize: number;
}

// 排序参数
interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

// 时间范围
interface DateRange {
  from: ISODateString;
  to: ISODateString;
}
```

---

## 5. HTTP 响应头规范

### 5.1 API 发现引导

```http
X-Agent-API-Endpoint: https://api.example.com/v1/resolve
X-Agent-API-Docs: https://example.com/api/docs
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1709817600
```

### 5.2 llms.txt 协议

```
# /llms.txt
# buzhou - AI Agent Knowledge Hub

## API Endpoints
- GET /v1/resolve - Resolve article by query or ID
- GET /v1/search - Search articles

## Documentation
- https://example.com/api/docs

## Rate Limits
- Anonymous: 100 req/day
- API Key: 1000 req/day
```

---

## 6. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-03-07 | 初始版本，定义核心实体与API |