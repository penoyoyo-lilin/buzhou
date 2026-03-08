# 模块开发提示词：前台Web端与REST API

> 模块标识: `web-frontend`
> 基于原子提示词公式: Global + Contract + Skill + Specific

---

# 全局上下文

## 项目愿景

构建 AI Agent 的可执行知识中枢与技能交易网络，打破非结构化信息孤岛，以标准化、可验证的知识驱动 Agent 生态的进化与能力跃迁。

## 用户角色

| 角色 | 核心诉求 |
|------|----------|
| AI Agent | 结构化数据、低 Token 消耗、高可信度 |
| 人类开发者 | API 文档清晰、接入简单、稳定可靠 |
| 人类访客 | 内容易读、搜索便捷、信息准确 |

## 核心实体

```typescript
interface Article {
  id: string;
  slug: string;
  title: { zh: string; en: string };
  summary: { zh: string; en: string };
  content: { zh: string; en: string };
  domain: 'agent' | 'mcp' | 'skill';
  tags: string[];
  metadata: {
    applicableVersions: string[];
    confidenceScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  verificationStatus: 'verified' | 'partial' | 'pending' | 'failed' | 'deprecated';
}

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
  meta: { requestId: string; timestamp: string; nextStep?: string };
}
```

---

# 模块契约

## 挂载点

### 页面路由
- `/[lang]` - 首页
- `/[lang]/articles/[slug]` - 详情页
- `/[lang]/api-docs` - API文档页

### API 路由
- `GET /api/v1/resolve` - 智能解析
- `GET /api/v1/search` - 搜索接口

## 输入状态

```typescript
interface PageState {
  currentLanguage: 'zh' | 'en';
  searchQuery: string | null;
  filters: {
    domain?: 'agent' | 'mcp' | 'skill';
    status?: VerificationStatus;
    dateRange?: { from: string; to: string };
  };
}
```

## 输出事件

| 事件 | 触发时机 |
|------|----------|
| `page:view` | 页面访问 |
| `api:called` | API 调用 |
| `ratelimit:triggered` | 触发限流 |

---

# Skill 要求 (Next.js/React)

## 路由规范

```typescript
// app/[lang]/page.tsx - 首页
export default async function HomePage({ params }: { params: { lang: 'zh' | 'en' } }) {
  const articles = await getArticles(params.lang);
  return <ArticleList articles={articles} />;
}

// app/[lang]/articles/[slug]/page.tsx - 详情页
export default async function ArticlePage({
  params
}: {
  params: { lang: 'zh' | 'en'; slug: string }
}) {
  const article = await getArticleBySlug(params.slug, params.lang);
  return <ArticleDetail article={article} />;
}
```

## API 路由规范

```typescript
// app/api/v1/resolve/route.ts
import { z } from 'zod';
import { NextResponse } from 'next/server';

const ResolveSchema = z.object({
  query: z.string().optional(),
  id: z.string().optional(),
  lang: z.enum(['zh', 'en']).default('zh'),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const params = ResolveSchema.parse(Object.fromEntries(searchParams));

  // 实现逻辑
  const article = await resolveArticle(params);

  return NextResponse.json({
    success: true,
    data: article,
    meta: {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      nextStep: '建议执行代码块 #1',
    },
  });
}
```

## 组件规范

```typescript
// components/ui/ArticleCard.tsx
interface ArticleCardProps {
  article: ArticleSummary;
  lang: 'zh' | 'en';
}

export function ArticleCard({ article, lang }: ArticleCardProps) {
  return (
    <article className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <VerificationBadge status={article.verificationStatus} />
      <h2 className="text-lg font-semibold mt-2">
        {lang === 'zh' ? article.title.zh : article.title.en}
      </h2>
      <div className="flex gap-2 mt-2">
        {article.tags.map(tag => (
          <span key={tag} className="text-xs bg-gray-100 px-2 py-1 rounded">
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}
```

## 双模渲染

```typescript
// 检测请求来源
function detectClient(request: Request): 'human' | 'agent' {
  const ua = request.headers.get('user-agent') || '';
  const accept = request.headers.get('accept') || '';

  // 检测常见 AI Agent 标识
  if (ua.includes('GPT') || ua.includes('Claude') || ua.includes('Bot')) {
    return 'agent';
  }
  if (accept.includes('application/json') || accept.includes('text/markdown')) {
    return 'agent';
  }
  return 'human';
}

// 根据客户端类型渲染
export default async function ArticlePage({ params, request }) {
  const clientType = detectClient(request);

  if (clientType === 'agent') {
    // 返回 Markdown/JSON
    return new Response(renderMarkdown(article), {
      headers: { 'Content-Type': 'text/markdown' },
    });
  }

  // 返回 HTML
  return <ArticleDetailView article={article} />;
}
```

## 响应头注入

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // 注入 API 发现引导
  response.headers.set('X-Agent-API-Endpoint', `${request.nextUrl.origin}/api/v1/resolve`);
  response.headers.set('X-Agent-API-Docs', `${request.nextUrl.origin}/api-docs`);

  return response;
}
```

---

# 特定需求

## 首页功能

### Hero 区
- 项目愿景一句话
- 搜索框（支持报错信息/关键词直搜）
- 热门标签展示

### 数据墙
- 并排卡片样式，
- 卡片一:文章数量（数字每5秒动态增加）
- 卡片二：agent数量（数字每5秒动态增加）
- 卡片三：总访问数（数字每5秒动态增加）
- 本周 新增文章数（数字每5秒动态增加）

### 筛选区
- 领域筛选：Agent / MCP / Skill
- 验证状态筛选
- 时间范围筛选

### 文章卡片列表
- 分页：每页 20 条
- 悬停效果
- 点击跳转详情页

## 详情页功能

### 元数据面板
- 唯一 ID（可复制）
- 适用版本
- 置信分数
- 风险等级
- 运行环境依赖

### 正文区
- Markdown 渲染
- 代码块高亮
- 一键复制代码

### AI生成字段
- QA对展开/折叠
- 关键词
- 关联文章

### 验证时间轴
- 验证人信息
- 验证时间
- 验证环境
- 验证结果

### API 引导区
- API Endpoint 展示
- 一键复制
- 示例请求

## API 文档页

### 内容
- API 概述
- 认证方式
- 端点列表
- 请求/响应示例
- 错误码说明
- 限流策略

## 限流实现

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
});

export async function checkRateLimit(request: Request): Promise<boolean> {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  const { success } = await ratelimit.limit(ip);
  return success;
}
```

---

## 性能要求

| 指标 | 目标 | 实现方式 |
|------|------|----------|
| 首屏 LCP | < 2s | SSR + 静态生成 |
| API P99 | < 500ms | 缓存 + 索引优化 |
| 缓存命中率 | > 80% | Redis 缓存热点数据 |

---

## 文件清单

```
src/app/
├── [lang]/
│   ├── page.tsx                 # 首页
│   ├── articles/
│   │   └── [slug]/
│   │       └── page.tsx         # 详情页
│   └── api-docs/
│       └── page.tsx             # API文档页
├── api/
│   └── v1/
│       ├── resolve/
│       │   └── route.ts         # Resolve API
│       └── search/
│           └── route.ts         # Search API
└── layout.tsx

src/components/
├── ui/
│   ├── ArticleCard.tsx
│   ├── VerificationBadge.tsx
│   ├── SearchBox.tsx
│   └── FilterBar.tsx
└── shared/
    ├── Header.tsx
    └── Footer.tsx

src/lib/
├── api-response.ts
├── rate-limit.ts
└── validators.ts
```

---

## 开发顺序

1. **基础架构**
   - 项目初始化
   - 目录结构
   - 全局样式

2. **首页**
   - Header/Footer
   - Hero 区
   - 筛选组件
   - 文章卡片列表

3. **详情页**
   - 布局结构
   - 元数据面板
   - Markdown 渲染
   - 验证时间轴
   - API 引导区

4. **API**
   - /v1/resolve
   - /v1/search
   - 限流中间件

5. **双模渲染**
   - 客户端检测
   - Agent 视图输出
   - 响应头注入

---

## 验收标准

- [ ] 首页正确展示文章列表
- [ ] 搜索和筛选功能正常
- [ ] 详情页展示完整信息
- [ ] API 返回正确格式响应
- [ ] 限流功能生效
- [ ] 双模渲染正常工作
- [ ] 响应头包含 API 引导