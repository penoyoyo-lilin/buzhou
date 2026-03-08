# 模块开发提示词：内容供给管线&知识存储

> 模块标识: `content-pipeline`
> 基于原子提示词公式: Global + Contract + Skill + Specific

---

# 全局上下文

## 项目愿景

构建 AI Agent 的可执行知识中枢与技能交易网络，打破非结构化信息孤岛，以标准化、可验证的知识驱动 Agent 生态的进化与能力跃迁。

## 核心实体

```typescript
interface Article {
  id: string;                    // art_<nanoid>
  slug: string;
  title: { zh: string; en: string };
  summary: { zh: string; en: string };
  content: { zh: string; en: string };  // Markdown
  domain: 'agent' | 'mcp' | 'skill';
  tags: string[];
  codeBlocks: CodeBlock[];
  metadata: ArticleMetadata;
  qaPairs: QAPair[];
  relatedIds: string[];
  verificationStatus: VerificationStatus;
  verificationRecords: VerificationRecord[];
  status: 'draft' | 'published' | 'archived' | 'deprecated';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

interface CodeBlock {
  id: string;
  language: string;
  filename: string | null;
  content: string;
  description: { zh: string; en: string };
}

interface ArticleMetadata {
  applicableVersions: string[];
  confidenceScore: number;       // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  runtimeEnv: { name: string; version: string }[];
}

interface QAPair {
  id: string;
  question: { zh: string; en: string };
  answer: { zh: string; en: string };
}

interface VerificationRecord {
  id: string;
  articleId: string;
  verifier: { id: string; type: string; name: string };
  result: 'passed' | 'failed' | 'partial';
  environment: { os: string; runtime: string; version: string };
  notes: string | null;
  verifiedAt: string;
}

type VerificationStatus = 'verified' | 'partial' | 'pending' | 'failed' | 'deprecated';
```

---

# 模块契约

## 挂载点

### 内部 API 路由
- `POST /api/internal/v1/articles` - 批量创建文章
- `GET/PUT/DELETE /api/internal/v1/articles/[id]` - 文章 CRUD
- `POST /api/internal/v1/articles/[id]/publish` - 发布文章
- `POST /api/internal/v1/articles/[id]/verify` - 添加验证记录
- `GET/POST /api/internal/v1/verifiers` - 验证人管理

### 服务接口（代码级）

```typescript
interface ContentPipelineServices {
  articleService: ArticleService;
  verificationService: VerificationService;
  verifierService: VerifierService;
  renderService: RenderService;
}
```

## 输出事件

| 事件 | 触发时机 |
|------|----------|
| `article:created` | 文章创建 |
| `article:published` | 文章发布 |
| `article:verified` | 文章验证 |
| `article:updated` | 文章更新 |

---

# Skill 要求 (Prisma/TypeScript)

## Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ArticleDomain {
  agent
  mcp
  skill
}

enum ArticleStatus {
  draft
  published
  archived
  deprecated
}

enum VerificationStatus {
  verified
  partial
  pending
  failed
  deprecated
}

enum VerificationResult {
  passed
  failed
  partial
}

enum VerifierType {
  official_bot
  third_party_agent
  human_expert
}

enum VerifierStatus {
  active
  suspended
  retired
}

model Article {
  id                  String             @id @default(cuid())
  slug                String             @unique
  titleZh             String
  titleEn             String
  summaryZh           String             @db.Text
  summaryEn           String             @db.Text
  contentZh           String             @db.Text
  contentEn           String             @db.Text
  domain              ArticleDomain
  tags                String[]
  codeBlocks          Json               // CodeBlock[]
  metadata            Json               // ArticleMetadata
  qaPairs             Json               // QAPair[]
  relatedIds          String[]
  status              ArticleStatus      @default(draft)
  verificationStatus  VerificationStatus @default(pending)

  verificationRecords VerificationRecord[]
  createdBy           String
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt
  publishedAt         DateTime?

  @@index([domain])
  @@index([status])
  @@index([verificationStatus])
  @@index([createdAt])
  @@index([slug])
}

model VerificationRecord {
  id          String             @id @default(cuid())
  articleId   String
  article     Article            @relation(fields: [articleId], references: [id], onDelete: Cascade)
  verifierId  String
  verifierType VerifierType
  verifierName String
  result      VerificationResult
  environment Json
  notes       String?
  verifiedAt  DateTime           @default(now())

  @@index([articleId])
  @@index([verifierId])
}

model Verifier {
  id               String         @id @default(cuid())
  type             VerifierType
  name             String
  description      String         @db.Text
  publicKey        String?
  certificateUrl   String?
  verified         Boolean        @default(false)
  reputationScore  Int            @default(0)
  totalVerifications Int          @default(0)
  status           VerifierStatus @default(active)
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([type])
  @@index([status])
}

model AgentApp {
  id              String        @id @default(cuid())
  name            String
  description     String        @db.Text
  owner           String
  apiKeyHash      String?
  apiKeyPrefix    String?
  apiKeyCreatedAt DateTime?
  dailyLimit      Int           @default(1000)
  monthlyLimit    Int           @default(30000)
  usedToday       Int           @default(0)
  usedThisMonth   Int           @default(0)
  lastResetDaily  DateTime      @default(now())
  lastResetMonthly DateTime     @default(now())
  status          AgentStatus   @default(active)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  lastAccessAt    DateTime?

  @@index([owner])
  @@index([status])
}

enum AgentStatus {
  active
  suspended
  revoked
}
```

## 服务层实现

### ArticleService

```typescript
// services/article.service.ts
import { prisma } from '@/core/db';
import { nanoid } from 'nanoid';

export class ArticleService {
  async findById(id: string) {
    return prisma.article.findUnique({ where: { id } });
  }

  async findBySlug(slug: string) {
    return prisma.article.findUnique({ where: { slug } });
  }

  async search(params: SearchParams) {
    const { query, domain, status, page = 1, pageSize = 20 } = params;

    const where: any = {};

    if (domain) where.domain = { in: domain };
    if (status) where.verificationStatus = { in: status };

    if (query) {
      where.OR = [
        { titleZh: { contains: query, mode: 'insensitive' } },
        { titleEn: { contains: query, mode: 'insensitive' } },
        { tags: { has: query } },
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.article.count({ where }),
    ]);

    return { articles, pagination: { page, pageSize, total } };
  }

  async create(data: CreateArticleData) {
    const slug = data.slug || this.generateSlug(data.titleEn);

    // 生成 QA 对
    const qaPairs = data.qaPairs || await this.generateQAPairs(data);

    // 计算关联文章
    const relatedIds = data.relatedIds || await this.findRelated(data);

    return prisma.article.create({
      data: {
        id: `art_${nanoid(12)}`,
        slug,
        titleZh: data.title.zh,
        titleEn: data.title.en,
        summaryZh: data.summary.zh,
        summaryEn: data.summary.en,
        contentZh: data.content.zh,
        contentEn: data.content.en,
        domain: data.domain,
        tags: data.tags,
        codeBlocks: data.codeBlocks || [],
        metadata: data.metadata,
        qaPairs,
        relatedIds,
        createdBy: data.createdBy,
      },
    });
  }

  async publish(id: string) {
    return prisma.article.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async generateQAPairs(data: CreateArticleData): Promise<QAPair[]> {
    // 基于内容摘要生成 QA 对
    // 实现...
  }

  private async findRelated(data: CreateArticleData): Promise<string[]> {
    // 基于向量相似度计算关联文章
    // 实现...
  }
}
```

### VerificationService

```typescript
// services/verification.service.ts
export class VerificationService {
  async createRecord(data: CreateVerificationData) {
    const record = await prisma.verificationRecord.create({
      data: {
        articleId: data.articleId,
        verifierId: data.verifierId,
        verifierType: data.verifierType,
        verifierName: data.verifierName,
        result: data.result,
        environment: data.environment,
        notes: data.notes,
      },
    });

    // 更新文章验证状态
    await this.updateArticleStatus(data.articleId);

    // 更新验证人信誉
    await this.updateVerifierReputation(data.verifierId, data.result);

    return record;
  }

  async updateArticleStatus(articleId: string) {
    const records = await prisma.verificationRecord.findMany({
      where: { articleId },
    });

    const status = this.calculateStatus(records);

    await prisma.article.update({
      where: { id: articleId },
      data: { verificationStatus: status },
    });
  }

  private calculateStatus(records: VerificationRecord[]): VerificationStatus {
    if (records.length === 0) return 'pending';

    const passed = records.filter(r => r.result === 'passed').length;
    const failed = records.filter(r => r.result === 'failed').length;
    const total = records.length;

    if (passed === total) return 'verified';
    if (failed > 0) return 'failed';
    return 'partial';
  }
}
```

### RenderService

```typescript
// services/render.service.ts
export class RenderService {
  private cache: Redis;

  constructor() {
    this.cache = new Redis(process.env.REDIS_URL);
  }

  async renderHuman(article: Article, lang: 'zh' | 'en'): Promise<string> {
    const cacheKey = `render:human:${article.id}:${lang}`;

    // 检查缓存
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    // 渲染 Markdown
    const content = lang === 'zh' ? article.contentZh : article.contentEn;
    const html = await this.markdownToHtml(content);

    // 缓存
    await this.cache.setex(cacheKey, 3600, html);

    return html;
  }

  async renderAgent(article: Article, format: 'markdown' | 'json'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify(this.toJsonResponse(article), null, 2);
    }

    return this.toMarkdown(article);
  }

  private async markdownToHtml(markdown: string): Promise<string> {
    // 使用 marked 或其他库渲染
  }

  private toJsonResponse(article: Article) {
    return {
      id: article.id,
      title: { zh: article.titleZh, en: article.titleEn },
      content: { zh: article.contentZh, en: article.contentEn },
      tags: article.tags,
      metadata: article.metadata,
      codeBlocks: article.codeBlocks,
      qaPairs: article.qaPairs,
    };
  }

  private toMarkdown(article: Article): string {
    return `# ${article.titleEn}

${article.summaryEn}

## Content
${article.contentEn}

## Code Blocks
${(article.codeBlocks as CodeBlock[]).map(b => `\`\`\`${b.language}\n${b.content}\n\`\`\``).join('\n\n')}

## Q&A
${(article.qaPairs as QAPair[]).map(qa => `Q: ${qa.question.en}\nA: ${qa.answer.en}`).join('\n\n')}
`;
  }
}
```

---

# 特定需求

## 内部 API 认证

```typescript
// middleware/internal-auth.ts
export function verifyInternalAuth(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  const expectedKey = process.env.INTERNAL_API_KEY;

  if (!authHeader || !expectedKey) return false;

  return authHeader === `Bearer ${expectedKey}`;
}

// 使用
export async function POST(request: Request) {
  if (!verifyInternalAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 处理请求
}
```

## 批量创建流程

```typescript
// app/api/internal/v1/articles/route.ts
export async function POST(request: Request) {
  if (!verifyInternalAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const items = Array.isArray(body) ? body : [body];

  const results = [];

  for (const item of items) {
    // 沙盒验证（可选跳过）
    if (!item.skipVerification) {
      const verificationResult = await sandboxVerify(item);
      if (verificationResult !== 'passed') {
        results.push({ error: 'Verification failed', item });
        continue;
      }
    }

    // 创建文章
    const article = await articleService.create(item);
    results.push({ success: true, article });
  }

  return NextResponse.json({ results });
}
```

## 沙盒验证引擎

```typescript
// services/sandbox.service.ts
export class SandboxService {
  async verify(article: Article): Promise<VerificationResult> {
    const codeBlocks = article.codeBlocks as CodeBlock[];

    for (const block of codeBlocks) {
      try {
        await this.executeCode(block);
      } catch (error) {
        return 'failed';
      }
    }

    return 'passed';
  }

  private async executeCode(block: CodeBlock): Promise<void> {
    // 使用 Docker 或 VM 执行代码
    // 设置超时和资源限制
  }
}
```

---

## 文件清单

```
prisma/
└── schema.prisma

src/core/
├── db/
│   └── index.ts              # Prisma client
├── cache/
│   └── index.ts              # Redis client
└── events/
    └── index.ts              # Event bus

src/services/
├── article.service.ts
├── verification.service.ts
├── verifier.service.ts
├── render.service.ts
└── sandbox.service.ts

src/app/api/internal/v1/
├── articles/
│   ├── route.ts              # 批量创建
│   └── [id]/
│       ├── route.ts          # CRUD
│       ├── publish/route.ts
│       └── verify/route.ts
└── verifiers/
    ├── route.ts
    └── [id]/route.ts

src/lib/
├── validators.ts
└── internal-auth.ts
```

---

## 开发顺序

1. **数据库层**
   - Prisma schema
   - 数据库迁移
   - Prisma client

2. **核心服务**
   - ArticleService
   - VerificationService
   - VerifierService

3. **内部 API**
   - 认证中间件
   - 文章 CRUD
   - 验证接口

4. **渲染服务**
   - Markdown 渲染
   - JSON 输出
   - 缓存层

5. **沙盒引擎**
   - 代码执行
   - 超时控制
   - 安全隔离

---

## 验收标准

- [ ] 文章 CRUD 正常
- [ ] 批量创建正常
- [ ] 验证记录创建正常
- [ ] 验证状态更新正确
- [ ] 渲染输出格式正确
- [ ] 缓存工作正常
- [ ] 沙盒验证正常