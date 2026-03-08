# 模块开发提示词：管理后台

> 模块标识: `admin-panel`
> 基于原子提示词公式: Global + Contract + Skill + Specific

---

# 全局上下文

## 项目愿景

构建 AI Agent 的可执行知识中枢与技能交易网络，打破非结构化信息孤岛，以标准化、可验证的知识驱动 Agent 生态的进化与能力跃迁。

## 用户角色

| 角色 | 核心诉求 |
|------|----------|
| 运营管理员 | 高效管理内容、监控数据、风控合规 |

## 核心实体

```typescript
interface Article {
  id: string;
  slug: string;
  title: { zh: string; en: string };
  status: 'draft' | 'published' | 'archived' | 'deprecated';
  verificationStatus: 'verified' | 'partial' | 'pending' | 'failed' | 'deprecated';
  createdBy: string;
  createdAt: string;
  publishedAt: string | null;
}

interface Verifier {
  id: string;
  type: 'official_bot' | 'third_party_agent' | 'human_expert';
  name: string;
  reputationScore: number;
  status: 'active' | 'suspended' | 'retired';
}

interface AgentApp {
  id: string;
  name: string;
  apiKey: { prefix: string };
  quota: { dailyLimit: number; monthlyLimit: number };
  status: 'active' | 'suspended' | 'revoked';
}

interface Admin {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'editor' | 'viewer';
}
```

---

# 模块契约

## 挂载点

### 页面路由
- `/admin/login` - 登录页
- `/admin/dashboard` - 仪表盘
- `/admin/articles` - 文章管理
- `/admin/verifiers` - 验证人管理
- `/admin/agents` - Agent管理
- `/admin/stats` - 访问统计

### API 路由
- `POST /api/admin/auth/login` - 登录
- `GET/POST /api/admin/articles` - 文章列表/创建
- `GET/PUT/DELETE /api/admin/articles/[id]` - 文章详情/更新/删除
- `POST /api/admin/articles/[id]/feature` - 置顶
- `POST /api/admin/articles/[id]/deprecate` - 标记失效
- `GET/POST /api/admin/agents/[id]/api-key` - API Key 管理

## 输入状态

```typescript
interface AdminState {
  currentAdmin: Admin | null;
  permissions: Permission[];
  sidebarCollapsed: boolean;
}

type Permission =
  | 'article:read' | 'article:write' | 'article:delete'
  | 'verifier:read' | 'verifier:write'
  | 'agent:read' | 'agent:write'
  | 'stats:read';
```

## 输出事件

| 事件 | 触发时机 |
|------|----------|
| `article:updated` | 文章更新 |
| `article:featured` | 文章置顶 |
| `article:deprecated` | 文章标记失效 |
| `agent:api-key-generated` | 生成 API Key |
| `agent:quota-updated` | 更新额度 |

---

# Skill 要求 (Next.js/React)

## 布局结构

```typescript
// app/admin/layout.tsx
export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 p-6">
        <Header />
        {children}
      </main>
    </div>
  );
}
```

## 认证中间件

```typescript
// middleware.ts (admin 路由保护)
export function middleware(request: NextRequest) {
  const session = request.cookies.get('admin_session');

  if (!session && request.nextUrl.pathname.startsWith('/admin')) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/admin/:path*',
};
```

## 登录流程

```typescript
// app/admin/login/page.tsx
'use client';

export default function LoginPage() {
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const formData = new FormData(e.target);

    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: formData.get('email'),
        password: formData.get('password'),
      }),
    });

    if (res.ok) {
      router.push('/admin/dashboard');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit">登录</button>
    </form>
  );
}
```

## 数据表格组件

```typescript
// components/admin/DataTable.tsx
interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pagination: { page: number; total: number; pageSize: number };
  onPageChange: (page: number) => void;
}

export function DataTable<T>({ data, columns, pagination, onPageChange }: DataTableProps<T>) {
  return (
    <div>
      <table className="w-full">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Pagination {...pagination} onChange={onPageChange} />
    </div>
  );
}
```

## 权限控制 Hook

```typescript
// hooks/usePermission.ts
export function usePermission() {
  const { currentAdmin, permissions } = useAdminStore();

  const can = (permission: Permission): boolean => {
    if (!currentAdmin) return false;
    if (currentAdmin.role === 'super_admin') return true;
    return permissions.includes(permission);
  };

  return { can };
}

// 使用
function ArticleListPage() {
  const { can } = usePermission();

  return (
    <div>
      <DataTable data={articles} />
      {can('article:write') && <CreateButton />}
    </div>
  );
}
```

---

# 特定需求

## 仪表盘

### 统计卡片
- 文章总数
- 待验证文章数
- Agent 活跃数
- API 调用量（今日）

### 快捷操作
- 最新待审文章
- 最新验证请求
- 系统告警

## 文章管理

### 列表页
- 搜索：标题/ID
- 筛选：状态/领域/验证状态
- 排序：创建时间/更新时间
- 操作：查看/编辑/删除/置顶/标记失效

### 编辑页
- 多语言标题/摘要/内容
- 标签管理
- 元数据编辑
- 代码块管理
- QA对管理
- 关联文章
- 验证记录管理

### AI生成字段
- 发布文章时由 AI 生成 QA 对、关键词、关联文章

## 验证人管理

### 列表页
- 搜索：名称/ID
- 筛选：类型/状态
- 信誉分展示

### 详情页
- 基本信息
- 认证信息
- 信誉历史
- 验证记录

## Agent 管理

### 列表页
- 搜索：名称/ID
- 筛选：状态
- 额度使用情况

### 详情页
- 基本信息
- API Key 管理
- 额度配置
- 调用统计

### API Key 生成

```typescript
// 生成 API Key
async function generateApiKey(agentId: string) {
  const key = `sk_${nanoid(32)}`;
  const keyHash = await bcrypt.hash(key, 10);
  const prefix = key.substring(0, 8);

  await prisma.agentApp.update({
    where: { id: agentId },
    data: {
      apiKey: {
        keyHash,
        prefix,
        createdAt: new Date(),
      },
    },
  });

  // 仅显示一次
  return { key, prefix };
}
```

## 访问统计

### 流量分析
- 访问量趋势
- 来源分布
- 设备分布
- Bot vs Human 比例

### API 统计
- 调用量趋势
- 响应时间分布
- 错误率
- Top Agent

### 热门内容
- 热门文章排行
- 热门搜索词

---

## 文件清单

```
src/app/admin/
├── layout.tsx
├── login/
│   └── page.tsx
├── dashboard/
│   └── page.tsx
├── articles/
│   ├── page.tsx              # 列表
│   └── [id]/
│       └── page.tsx          # 编辑
├── verifiers/
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
├── agents/
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
└── stats/
    └── page.tsx

src/app/api/admin/
├── auth/
│   ├── login/route.ts
│   └── logout/route.ts
├── articles/
│   ├── route.ts
│   └── [id]/
│       ├── route.ts
│       ├── feature/route.ts
│       └── deprecate/route.ts
├── verifiers/
│   └── [id]/route.ts
├── agents/
│   ├── route.ts
│   └── [id]/
│       ├── route.ts
│       └── api-key/route.ts
└── stats/
    ├── overview/route.ts
    ├── traffic/route.ts
    └── api/route.ts

src/components/admin/
├── Sidebar.tsx
├── Header.tsx
├── DataTable.tsx
├── StatCard.tsx
├── ArticleForm.tsx
└── QuotaEditor.tsx

src/stores/
└── admin-store.ts
```

---

## 开发顺序

1. **基础架构**
   - 布局组件
   - 认证流程
   - 权限系统

2. **仪表盘**
   - 统计卡片
   - 快捷操作

3. **文章管理**
   - 列表页
   - 编辑页
   - 操作按钮

4. **验证人管理**
   - 列表页
   - 详情页

5. **Agent 管理**
   - 列表页
   - 详情页
   - API Key 生成

6. **访问统计**
   - 流量图表
   - API 统计

---

## 验收标准

- [ ] 登录/登出功能正常
- [ ] 权限控制生效
- [ ] 文章 CRUD 正常
- [ ] 验证人管理正常
- [ ] Agent API Key 生成正常
- [ ] 统计数据展示正确
- [ ] 操作审计记录完整