# 模块契约：管理后台

> 模块标识: `admin-panel`
> 版本: 1.0.0

---

## 1. 模块概述

**领域边界**：运营与风控中心，全链路管控内容与用户。

**核心职责**：
- 文章管理（CRUD、置顶、标记失效）
- 验证人管理（认证、信誉分）
- Agent 管理（API Key、额度配置）
- 访问统计（流量分析、API 监控）

---

## 2. 挂载点

### 2.1 页面路由

| 路由 | 组件 | 描述 |
|------|------|------|
| `/admin` | `AdminLayout` | 管理后台布局 |
| `/admin/login` | `LoginPage` | 登录页 |
| `/admin/dashboard` | `DashboardPage` | 仪表盘总览 |
| `/admin/articles` | `ArticleListPage` | 文章列表 |
| `/admin/articles/[id]` | `ArticleDetailPage` | 文章详情/编辑 |
| `/admin/verifiers` | `VerifierListPage` | 验证人列表 |
| `/admin/verifiers/[id]` | `VerifierDetailPage` | 验证人详情 |
| `/admin/agents` | `AgentListPage` | Agent 列表 |
| `/admin/agents/[id]` | `AgentDetailPage` | Agent 详情 |
| `/admin/stats` | `StatsPage` | 访问统计 |

### 2.2 API 路由

| 路由 | 方法 | 描述 |
|------|------|------|
| `/api/admin/auth/login` | POST | 登录认证 |
| `/api/admin/auth/logout` | POST | 登出 |
| `/api/admin/articles` | GET/POST | 文章列表/创建 |
| `/api/admin/articles/[id]` | GET/PUT/DELETE | 文章详情/更新/删除 |
| `/api/admin/articles/[id]/feature` | POST | 置顶 |
| `/api/admin/articles/[id]/deprecate` | POST | 标记失效 |
| `/api/admin/verifiers` | GET | 验证人列表 |
| `/api/admin/verifiers/[id]` | GET/PUT | 验证人详情/更新 |
| `/api/admin/agents` | GET | Agent 列表 |
| `/api/admin/agents/[id]` | GET/PUT | Agent 详情/更新 |
| `/api/admin/agents/[id]/api-key` | POST | 生成 API Key |
| `/api/admin/stats/overview` | GET | 统计总览 |
| `/api/admin/stats/traffic` | GET | 流量分析 |
| `/api/admin/stats/api` | GET | API 统计 |

---

## 3. 输入状态（订阅）

### 3.1 全局状态订阅

```typescript
interface GlobalStateSubscription {
  // 当前管理员
  currentAdmin: Admin | null;

  // 权限列表
  permissions: Permission[];
}

interface Admin {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

type AdminRole = 'super_admin' | 'admin' | 'editor' | 'viewer';

type Permission =
  | 'article:read' | 'article:write' | 'article:delete'
  | 'verifier:read' | 'verifier:write'
  | 'agent:read' | 'agent:write'
  | 'stats:read';
```

### 3.2 数据依赖

| 数据 | 来源 | 订阅方式 |
|------|------|----------|
| 文章数据 | ArticleService | 按需获取 |
| 验证人数据 | VerifierService | 按需获取 |
| Agent 数据 | AgentService | 按需获取 |
| 统计数据 | StatsService | 按需获取 |

---

## 4. 输出事件

### 4.1 文章管理事件

```typescript
// 事件: article:updated
interface ArticleUpdatedEvent {
  type: 'article:updated';
  payload: {
    articleId: string;
    updatedBy: string;  // 管理员 ID
    changes: string[];  // 变更字段
    timestamp: ISODateString;
  };
}

// 事件: article:featured
interface ArticleFeaturedEvent {
  type: 'article:featured';
  payload: {
    articleId: string;
    featuredBy: string;
    featuredUntil: ISODateString | null;
  };
}

// 事件: article:deprecated
interface ArticleDeprecatedEvent {
  type: 'article:deprecated';
  payload: {
    articleId: string;
    deprecatedBy: string;
    reason: string;
  };
}

// 事件: article:deleted
interface ArticleDeletedEvent {
  type: 'article:deleted';
  payload: {
    articleId: string;
    deletedBy: string;
    reason: string;
  };
}
```

### 4.2 验证人管理事件

```typescript
// 事件: verifier:updated
interface VerifierUpdatedEvent {
  type: 'verifier:updated';
  payload: {
    verifierId: string;
    updatedBy: string;
    changes: string[];
  };
}
```

### 4.3 Agent 管理事件

```typescript
// 事件: agent:api-key-generated
interface AgentApiKeyGeneratedEvent {
  type: 'agent:api-key-generated';
  payload: {
    agentId: string;
    generatedBy: string;
    expiresAt: ISODateString | null;
  };
}

// 事件: agent:quota-updated
interface AgentQuotaUpdatedEvent {
  type: 'agent:quota-updated';
  payload: {
    agentId: string;
    updatedBy: string;
    dailyLimit: number;
    monthlyLimit: number;
  };
}

// 事件: agent:status-changed
interface AgentStatusChangedEvent {
  type: 'agent:status-changed';
  payload: {
    agentId: string;
    changedBy: string;
    previousStatus: AgentStatus;
    newStatus: AgentStatus;
    reason: string;
  };
}
```

---

## 5. 暴露接口

### 5.1 内部服务接口

```typescript
// 供其他模块调用的接口
interface AdminPanelPublicAPI {
  // 检查权限
  checkPermission(adminId: string, permission: Permission): Promise<boolean>;

  // 获取管理员信息
  getAdmin(adminId: string): Promise<Admin | null>;
}
```

### 5.2 不暴露的内容

- 不暴露认证实现细节
- 不暴露内部管理操作日志
- 不暴露其他管理员的敏感信息

---

## 6. 生命周期钩子

### 6.1 初始化

```typescript
async function onInit(): Promise<void> {
  // 1. 加载权限配置
  // 2. 初始化 Session 管理
  // 3. 注册管理路由
}
```

### 6.2 认证检查

```typescript
// 每次管理请求前执行
async function onAdminRequest(request: Request): Promise<{
  authorized: boolean;
  admin: Admin | null;
}> {
  // 1. 验证 Session
  // 2. 检查权限
  // 3. 记录操作日志
}
```

### 6.3 操作审计

```typescript
// 每次管理操作后执行
async function onAdminAction(action: AdminAction): Promise<void> {
  // 1. 记录操作日志
  // 2. 发布审计事件
}
```

---

## 7. 依赖声明

### 7.1 服务依赖

| 服务 | 模块 | 用途 |
|------|------|------|
| ArticleService | content-pipeline | 文章 CRUD |
| VerifierService | content-pipeline | 验证人管理 |
| AgentService | core | Agent 管理 |
| StatsService | core | 统计数据 |

### 7.2 基础设施依赖

| 组件 | 用途 |
|------|------|
| Redis | Session 存储 |
| PostgreSQL | 数据读写 |

---

## 8. 安全要求

### 8.1 认证要求

- Session 过期时间：2 小时
- 支持 2FA（二期）
- 登录失败锁定：5 次失败后锁定 15 分钟

### 8.2 权限控制

- RBAC 权限模型
- 敏感操作需要 super_admin 权限
- 所有操作记录审计日志

### 8.3 数据保护

- API Key 仅显示一次（生成时）
- 密码使用 bcrypt 加密
- 敏感字段脱敏显示

---

## 9. UI 组件规范

### 9.1 布局结构

```
┌─────────────────────────────────────────────────────────────┐
│  Logo    [文章] [验证人] [Agent] [统计]          [头像 ▼]   │
├─────────────────────────────────────────────────────────────┤
│         │                                                   │
│  侧边栏  │              内容区域                            │
│         │                                                   │
│  - 仪表盘│                                                   │
│  - 文章  │                                                   │
│  - 验证人│                                                   │
│  - Agent │                                                   │
│  - 统计  │                                                   │
│         │                                                   │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 表格规范

- 分页：每页 20 条
- 排序：支持多字段
- 筛选：顶部筛选栏
- 操作：行内操作按钮

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-03-07 | 初始契约 |