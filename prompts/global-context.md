# 全局上下文 (Global Context)

> 本文档是所有模块的共享上下文，在开发任何模块时都必须加载。

---

## 项目愿景

构建 AI Agent 的可执行知识中枢与技能交易网络，打破非结构化信息孤岛，以标准化、可验证的知识驱动 Agent 生态的进化与能力跃迁。

## 价值主张

通过提供"结构化、经沙盒验证、即取即用"的知识内容与标准化 REST API，解决 Agent 在传统网络中获取信息清洗成本高、决策依据不可信、执行链路断裂的痛点。

---

## 用户角色

| 角色 | 描述 | 核心诉求 |
|------|------|----------|
| **AI Agent** | 自动化程序，通过 API 获取知识 | 结构化数据、低 Token 消耗、高可信度 |
| **人类开发者** | 构建应用的开发者 | API 文档清晰、接入简单、稳定可靠 |
| **人类访客** | 浏览知识的普通用户 | 内容易读、搜索便捷、信息准确 |
| **运营管理员** | 平台内容管理者 | 高效管理内容、监控数据、风控合规 |

---

## 技术栈

### 前端
- Next.js 14.x (App Router)
- React 18.x
- TypeScript 5.x
- Tailwind CSS 3.x
- Radix UI
- Zustand + React Query

### 后端
- Next.js API Routes
- Prisma 5.x
- PostgreSQL 15.x
- Redis 7.x
- Zod 3.x

---

## 核心实体

### Article（文章）

```typescript
interface Article {
  id: string;                    // art_<nanoid>
  slug: string;
  title: LocalizedString;
  summary: LocalizedString;
  content: LocalizedString;      // Markdown
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

type VerificationStatus = 'verified' | 'partial' | 'pending' | 'failed' | 'deprecated';

interface LocalizedString {
  zh: string;
  en: string;
}
```

### VerificationRecord（验证记录）

```typescript
interface VerificationRecord {
  id: string;
  articleId: string;
  verifier: {
    id: string;
    type: 'official_bot' | 'third_party_agent' | 'human_expert';
    name: string;
  };
  result: 'passed' | 'failed' | 'partial';
  environment: {
    os: string;
    runtime: string;
    version: string;
  };
  notes: string | null;
  verifiedAt: string;
}
```

### AgentApp（Agent应用）

```typescript
interface AgentApp {
  id: string;
  name: string;
  description: string;
  owner: string;
  apiKey: {
    keyHash: string;
    prefix: string;
  };
  quota: {
    dailyLimit: number;
    monthlyLimit: number;
    usedToday: number;
    usedThisMonth: number;
  };
  status: 'active' | 'suspended' | 'revoked';
}
```

---

## API 格式

### 通用响应

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
  meta: {
    requestId: string;
    timestamp: string;
    nextStep?: string;
  };
}
```

### REST API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/v1/resolve` | GET | 智能解析（query 或 id） |
| `/api/v1/search` | GET | 搜索文章 |

---

## 设计原则

### AI-First Design
- 优先考虑 AI Agent 的信息获取效率
- 关键数据同步渲染（非异步 JS）
- HTML 注释内嵌 API 引导指令

### 双模渲染
- 人类视图：优化排版、代码高亮
- Agent 视图：Markdown/JSON 纯净输出

### 信息密度优先
- 减少装饰性元素
- 最大化有效信息

---

## 业务规则

### 1. REST API 接入引导
- Web-to-API 转化漏斗：搜索发现 → 页面引导 → API 调用
- 免Key体验模式：初期限额内开放
- 响应包含 `nextStep` 建议

### 2. 内容供给规则
- QA 对生成：每篇文章 3-5 组 QA
- 关联推荐：基于向量相似度计算 `relatedIds`
- 沙盒预验证：验证通过方可入库

---

## 性能指标

| 指标 | 目标值 |
|------|--------|
| 首屏加载 | < 2s |
| API P99 响应 | < 500ms |
| 缓存命中率 | > 80% |
| SLA | ≥ 99.9% |

---

## 目录结构

```
src/
├── app/                    # Next.js App Router
│   ├── [lang]/            # 国际化路由
│   ├── api/               # API 路由
│   └── admin/             # 管理后台
├── modules/               # 业务模块
├── core/                  # 核心基础设施
├── services/              # 领域服务
├── components/            # 共享组件
├── lib/                   # 工具函数
└── types/                 # 类型定义
```

---

## 强制规则

1. **类型安全**：所有函数必须有类型定义
2. **参数校验**：API 输入使用 Zod 校验
3. **错误处理**：使用统一的 ApiResponse 格式
4. **SQL 安全**：使用 Prisma 参数化查询
5. **无敏感信息**：禁止硬编码密钥、密码

---

## 版本

| 版本 | 日期 |
|------|------|
| 1.0.0 | 2026-03-07 |