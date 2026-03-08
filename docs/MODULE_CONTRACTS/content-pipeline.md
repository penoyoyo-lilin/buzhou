# 模块契约：内容供给管线&知识存储

> 模块标识: `content-pipeline`
> 版本: 1.0.0

---

## 1. 模块概述

**领域边界**：官方种子内容生产引擎 + 底层存储基础设施。

**核心职责**：
- 内部 Agent 高权限接口（批量写入、自动发布）
- 结构化存储（JSON格式、文章本体、元数据、验证记录）
- AISO 渲染引擎（人类HTML / Agent Markdown/JSON）
- 沙盒预验证机制

---

## 2. 挂载点

### 2.1 内部 API 路由

| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/internal/v1/articles` | POST | 批量创建文章 |
| `/api/internal/v1/articles/[id]` | GET/PUT/DELETE | 文章 CRUD |
| `/api/internal/v1/articles/[id]/publish` | POST | 发布文章 |
| `/api/internal/v1/articles/[id]/verify` | POST | 添加验证记录 |
| `/api/internal/v1/verifiers` | GET/POST | 验证人管理 |
| `/api/internal/v1/verifiers/[id]` | GET/PUT | 验证人详情 |

### 2.2 服务接口（代码级）

```typescript
// 直接暴露给其他模块的服务接口
interface ContentPipelineServices {
  articleService: ArticleService;
  verificationService: VerificationService;
  verifierService: VerifierService;
  renderService: RenderService;
}
```

---

## 3. 输入状态（订阅）

### 3.1 配置订阅

```typescript
interface PipelineConfig {
  // 沙盒配置
  sandbox: {
    enabled: boolean;
    timeout: number;      // ms
    maxRetries: number;
  };

  // 存储配置
  storage: {
    cacheTTL: number;     // 缓存过期时间
    maxPageSize: number;  // 最大分页
  };

  // 渲染配置
  render: {
    defaultView: 'human' | 'agent';
    markdownFlavor: 'gfm' | 'commonmark';
  };
}
```

### 3.2 事件订阅

```typescript
// 订阅来自其他模块的事件
interface SubscribedEvents {
  // 来自 admin-panel：文章被标记失效
  'article:deprecated': ArticleDeprecatedHandler;

  // 来自 web-frontend：统计更新请求
  'stats:update-request': StatsUpdateHandler;
}
```

---

## 4. 输出事件

### 4.1 文章生命周期事件

```typescript
// 事件: article:created
interface ArticleCreatedEvent {
  type: 'article:created';
  payload: {
    articleId: string;
    domain: ArticleDomain;
    createdBy: string;    // 内部 Agent ID
    status: ArticleStatus;
    timestamp: ISODateString;
  };
}

// 事件: article:published
interface ArticlePublishedEvent {
  type: 'article:published';
  payload: {
    articleId: string;
    publishedAt: ISODateString;
    publishedBy: string;
  };
}

// 事件: article:verified
interface ArticleVerifiedEvent {
  type: 'article:verified';
  payload: {
    articleId: string;
    verificationId: string;
    result: VerificationResult;
    verifierId: string;
    environment: VerificationEnv;
  };
}

// 事件: article:updated
interface ArticleUpdatedEvent {
  type: 'article:updated';
  payload: {
    articleId: string;
    updatedBy: string;
    changes: string[];
    timestamp: ISODateString;
  };
}
```

### 4.2 验证人事件

```typescript
// 事件: verifier:registered
interface VerifierRegisteredEvent {
  type: 'verifier:registered';
  payload: {
    verifierId: string;
    type: VerifierType;
    name: string;
  };
}

// 事件: verifier:reputation-changed
interface VerifierReputationChangedEvent {
  type: 'verifier:reputation-changed';
  payload: {
    verifierId: string;
    previousScore: number;
    newScore: number;
    reason: string;
  };
}
```

### 4.3 渲染事件

```typescript
// 事件: render:cache-miss
interface RenderCacheMissEvent {
  type: 'render:cache-miss';
  payload: {
    articleId: string;
    viewType: 'human' | 'agent';
    lang: 'zh' | 'en';
  };
}

// 事件: render:completed
interface RenderCompletedEvent {
  type: 'render:completed';
  payload: {
    articleId: string;
    viewType: 'human' | 'agent';
    renderTime: number;   // ms
    cacheStatus: 'hit' | 'miss';
  };
}
```

---

## 5. 暴露服务

### 5.1 ArticleService

```typescript
interface ArticleService {
  // 查询
  findById(id: string): Promise<Article | null>;
  findBySlug(slug: string): Promise<Article | null>;
  findByIds(ids: string[]): Promise<Article[]>;
  search(params: SearchParams): Promise<SearchResult>;

  // 创建/更新
  create(data: CreateArticleData): Promise<Article>;
  update(id: string, data: UpdateArticleData): Promise<Article>;

  // 状态变更
  publish(id: string): Promise<Article>;
  archive(id: string): Promise<Article>;
  deprecate(id: string, reason: string): Promise<Article>;

  // 批量操作
  bulkCreate(items: CreateArticleData[]): Promise<Article[]>;
  bulkUpdate(ids: string[], data: UpdateArticleData): Promise<number>;

  // 关联查询
  getRelated(id: string, limit?: number): Promise<Article[]>;
}

interface SearchParams {
  query?: string;
  domain?: ArticleDomain[];
  status?: ArticleStatus[];
  verificationStatus?: VerificationStatus[];
  tags?: string[];
  dateFrom?: ISODateString;
  dateTo?: ISODateString;
  page?: number;
  pageSize?: number;
  sortBy?: 'relevance' | 'date' | 'confidence';
  lang?: 'zh' | 'en';
}
```

### 5.2 VerificationService

```typescript
interface VerificationService {
  // 验证记录
  createRecord(data: CreateVerificationData): Promise<VerificationRecord>;
  getRecords(articleId: string): Promise<VerificationRecord[]>;
  getLatestRecord(articleId: string): Promise<VerificationRecord | null>;

  // 状态更新
  updateArticleStatus(articleId: string): Promise<void>;

  // 沙盒验证
  runSandboxVerification(article: Article): Promise<VerificationResult>;
}
```

### 5.3 VerifierService

```typescript
interface VerifierService {
  // CRUD
  findById(id: string): Promise<Verifier | null>;
  findByType(type: VerifierType): Promise<Verifier[]>;
  create(data: CreateVerifierData): Promise<Verifier>;
  update(id: string, data: UpdateVerifierData): Promise<Verifier>;

  // 信誉系统
  updateReputation(id: string, delta: number, reason: string): Promise<Verifier>;
  getStats(id: string): Promise<VerifierStats>;
}
```

### 5.4 RenderService

```typescript
interface RenderService {
  // 渲染
  renderHuman(article: Article, lang: 'zh' | 'en'): Promise<string>;
  renderAgent(article: Article, format: 'markdown' | 'json'): Promise<string>;

  // 缓存
  getCached(key: string): Promise<string | null>;
  setCache(key: string, content: string, ttl?: number): Promise<void>;
  invalidateCache(articleId: string): Promise<void>;

  // 批量预渲染
  preRender(articleIds: string[]): Promise<void>;
}
```

---

## 6. 生命周期钩子

### 6.1 初始化

```typescript
async function onInit(): Promise<void> {
  // 1. 初始化数据库连接 (Prisma)
  // 2. 初始化缓存连接 (Redis)
  // 3. 加载渲染模板
  // 4. 启动沙盒引擎
  // 5. 注册事件监听器
}
```

### 6.2 文章创建流程

```typescript
async function onArticleCreate(data: CreateArticleData): Promise<Article> {
  // 1. 数据校验 (Zod)
  // 2. 生成 QA 对
  // 3. 计算关联文章
  // 4. 沙盒预验证
  // 5. 存储到数据库
  // 6. 发布 article:created 事件
}
```

### 6.3 验证流程

```typescript
async function onVerification(articleId: string, verifierId: string): Promise<VerificationRecord> {
  // 1. 获取文章
  // 2. 执行沙盒验证
  // 3. 创建验证记录
  // 4. 更新文章验证状态
  // 5. 更新验证人信誉
  // 6. 发布 article:verified 事件
}
```

---

## 7. 数据模型

### 7.1 Prisma Schema 概要

```prisma
model Article {
  id                  String   @id @default(cuid())
  slug                String   @unique
  titleZh             String
  titleEn             String
  summaryZh           String
  summaryEn           String
  contentZh           String   @db.Text
  contentEn           String   @db.Text
  domain              ArticleDomain
  tags                String[]
  status              ArticleStatus @default(draft)
  verificationStatus  VerificationStatus @default(pending)

  // JSON 字段
  codeBlocks          Json
  metadata            Json
  qaPairs             Json
  relatedIds          String[]

  // 关联
  verificationRecords VerificationRecord[]
  createdBy           String
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  publishedAt         DateTime?

  @@index([domain])
  @@index([status])
  @@index([verificationStatus])
  @@index([createdAt])
}

model VerificationRecord {
  id          String   @id @default(cuid())
  articleId   String
  article     Article  @relation(fields: [articleId], references: [id])
  verifierId  String
  result      VerificationResult
  environment Json
  notes       String?
  verifiedAt  DateTime @default(now())

  @@index([articleId])
  @@index([verifierId])
}

model Verifier {
  id           String   @id @default(cuid())
  type         VerifierType
  name         String
  description  String
  publicKey    String?
  certificateUrl String?
  verified     Boolean  @default(false)
  reputationScore Int   @default(0)
  status       VerifierStatus @default(active)
  createdAt    DateTime @default(now())

  @@index([type])
  @@index([status])
}
```

---

## 8. 依赖声明

### 8.1 基础设施依赖

| 组件 | 用途 |
|------|------|
| PostgreSQL | 主数据存储 |
| Redis | 缓存、会话 |
| 沙盒引擎 | 代码验证 |

### 8.2 外部依赖

| 依赖 | 用途 |
|------|------|
| Markdown 解析器 | 渲染 Markdown |
| 代码高亮 | 人类视图代码高亮 |
| 向量数据库(可选) | 相似度计算 |

---

## 9. 性能要求

| 指标 | 目标值 |
|------|--------|
| 文章查询 P99 | < 100ms |
| 搜索 P99 | < 300ms |
| 批量写入吞吐 | > 100 文章/分钟 |
| 缓存命中率 | > 80% |

---

## 10. 安全要求

- 内部 API 需要服务间密钥认证
- 批量写入需要审批流程（可选）
- 沙盒执行隔离环境
- 敏感数据加密存储

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-03-07 | 初始契约 |