# 模块契约：前台Web端与REST API

> 模块标识: `web-frontend`
> 版本: 1.0.0

---

## 1. 模块概述

**领域边界**：面向人类访客与 AI 爬虫的双模展示层，提供 Web 页面和 REST API 服务。

**核心职责**：
- 渲染前台页面（首页、详情页、API文档页）
- 提供 REST API 服务（/v1/resolve、/v1/search）
- AISO 双模渲染（人类HTML / Agent Markdown/JSON）
- API 发现引导与 Web-to-API 转化

---

## 2. 挂载点

### 2.1 页面路由

| 路由 | 组件 | 描述 |
|------|------|------|
| `/[lang]` | `HomePage` | 首页，搜索+筛选+文章列表 |
| `/[lang]/articles/[slug]` | `ArticlePage` | 文章详情页 |
| `/[lang]/api-docs` | `ApiDocsPage` | API 接入文档页 |

### 2.2 API 路由

| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/v1/resolve` | GET | 智能解析接口 |
| `/api/v1/search` | GET | 搜索接口 |

### 2.3 API 响应头注入

所有页面响应必须注入：
```
X-Agent-API-Endpoint: https://{domain}/api/v1/resolve
X-Agent-API-Docs: https://{domain}/{lang}/api-docs
```

---

## 3. 输入状态（订阅）

### 3.1 全局状态订阅

```typescript
// 从全局状态订阅
interface GlobalStateSubscription {
  // 系统配置
  systemConfig: {
    siteName: string;
    defaultLanguage: 'zh' | 'en';
  };

  // 当前语言
  currentLanguage: 'zh' | 'en';

  // 用户信息（如有）
  currentUser: User | null;
}
```

### 3.2 数据依赖

| 数据 | 来源 | 订阅方式 |
|------|------|----------|
| 文章列表 | ArticleService | 按需获取 |
| 文章详情 | ArticleService | 按需获取 |
| 搜索结果 | ArticleService | 按需获取 |
| 验证记录 | VerificationService | 按需获取 |

---

## 4. 输出事件

### 4.1 页面访问事件

```typescript
// 事件: page:view
interface PageViewEvent {
  type: 'page:view';
  payload: {
    path: string;
    referrer: string | null;
    userAgent: string;
    isBot: boolean;
    timestamp: ISODateString;
  };
}
```

### 4.2 API 调用事件

```typescript
// 事件: api:called
interface ApiCalledEvent {
  type: 'api:called';
  payload: {
    endpoint: string;
    method: string;
    requestId: string;
    responseTime: number;
    statusCode: number;
    clientIp: string;
    userAgent: string;
    agentId: string | null;  // 如有 API Key
  };
}
```

### 4.3 限流触发事件

```typescript
// 事件: ratelimit:triggered
interface RateLimitEvent {
  type: 'ratelimit:triggered';
  payload: {
    clientIp: string;
    endpoint: string;
    limitType: 'ip' | 'api_key';
    currentCount: number;
    limit: number;
  };
}
```

---

## 5. 暴露接口

### 5.1 内部服务接口

```typescript
// 供其他模块调用的接口
interface WebFrontendPublicAPI {
  // 渲染文章详情（供内部跳转使用）
  getArticleUrl(articleId: string, lang: 'zh' | 'en'): string;

  // 获取 API Endpoint
  getApiEndpoint(): string;
}
```

### 5.2 不暴露的内容

- 不暴露内部渲染逻辑
- 不暴露限流配置
- 不暴露缓存实现

---

## 6. 生命周期钩子

### 6.1 初始化

```typescript
// 模块初始化时执行
async function onInit(): Promise<void> {
  // 1. 加载系统配置
  // 2. 初始化渲染引擎
  // 3. 注册 API 路由
  // 4. 启动限流器
}
```

### 6.2 请求处理

```typescript
// 每次请求前执行
async function onRequest(request: Request): Promise<void> {
  // 1. 解析语言偏好
  // 2. 检测 Bot/Agent
  // 3. 限流检查
  // 4. 日志记录
}
```

### 6.3 响应后处理

```typescript
// 每次响应后执行
async function onResponse(response: Response): Promise<void> {
  // 1. 注入 API 引导头
  // 2. 发布访问事件
  // 3. 更新统计
}
```

---

## 7. 依赖声明

### 7.1 服务依赖

| 服务 | 模块 | 用途 |
|------|------|------|
| ArticleService | content-pipeline | 获取文章数据 |
| VerificationService | content-pipeline | 获取验证记录 |
| CacheService | core | 缓存热点数据 |

### 7.2 基础设施依赖

| 组件 | 用途 |
|------|------|
| Redis | 限流计数、缓存 |
| PostgreSQL | 数据读取 |

---

## 8. 性能要求

| 指标 | 目标值 |
|------|--------|
| 首页 LCP | < 2.0s |
| 详情页 LCP | < 2.0s |
| API P99 响应 | < 500ms |
| 缓存命中率 | > 80% |

---

## 9. 安全要求

- 公开 API 限流：100 req/min (IP)
- API Key 认证：1000 req/day
- 禁止返回敏感字段（如内部 ID 映射）
- 所有查询使用参数化（Prisma）

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-03-07 | 初始契约 |