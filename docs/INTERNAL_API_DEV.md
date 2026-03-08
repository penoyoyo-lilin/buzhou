# Internal API 接入文档（开发环境）

> 高权限接口，供授权 Agent 接入使用
>
> **环境**: 本地开发环境 | **本地地址**: `http://localhost:3000`

---

## 当前公网访问地址

> **内网穿透地址** (通过 cloudflared，每次启动会变化):
>
> `https://shaved-sharon-listprice-operates.trycloudflare.com`
>
> **注意**: Openclaw Workspace 已配置为本地直连方式，不再使用内网穿透。
> 详见 [6. 已接入 Agent](#6-已接入-agent)。

---

## 环境说明

| 项目 | 本地地址 | 公网地址（内网穿透） |
|------|----------|---------------------|
| 环境 | 本地开发环境 | 通过 cloudflared 穿透 |
| API 地址 | `http://localhost:3000/api/internal/v1` | `https://shaved-sharon-listprice-operates.trycloudflare.com/api/internal/v1` |
| 数据库 | SQLite (`file:./data/buzhou.db`) | 同左 |
| 缓存 | 内存缓存 (DISABLE_REDIS=true) | 同左 |

> **提示**: 开发环境使用 SQLite 和内存缓存，无需配置 PostgreSQL 和 Redis。

---

## 1. 环境准备

### 1.1 启动开发服务器

```bash
cd /Users/lilin/project/buzhou

# 安装依赖（首次）
npm install

# 初始化数据库（首次）
npm run db:push

# 启动开发服务器
npm run dev
```

服务器启动后访问: http://localhost:3000

### 1.2 启动内网穿透（外网访问）

如需外网 Agent 访问，启动内网穿透：

```bash
# 安装 cloudflared（首次）
npm install -g cloudflared

# 启动穿透
cloudflared tunnel --url http://localhost:3000
```

输出示例：
```
Your quick Tunnel has been created! Visit it at:
https://xxx-xxx-xxx.trycloudflare.com
```

### 1.3 获取 API Key

查看 `.env` 文件中的 `INTERNAL_API_KEY`：

```bash
# 查看 API Key
cat .env | grep INTERNAL_API_KEY
```

如果没有配置，使用默认值或手动设置：

```bash
# .env 文件
INTERNAL_API_KEY="your-internal-api-key-change-in-production"
```

---

## 2. 认证方式

所有内部接口需要在请求头中携带 API Key：

```http
Authorization: Bearer YOUR_INTERNAL_API_KEY
Content-Type: application/json
```

---

## 3. 快速测试

### 3.1 测试连接

```bash
# 测试文章创建接口
curl -X POST http://localhost:3000/api/internal/v1/articles \
  -H "Authorization: Bearer your-internal-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": { "zh": "测试文章", "en": "Test Article" },
    "summary": { "zh": "测试摘要", "en": "Test Summary" },
    "content": { "zh": "这是测试内容", "en": "This is test content" },
    "domain": "agent",
    "createdBy": "dev-test"
  }'

# 测试验证人列表接口
curl -X GET http://localhost:3000/api/internal/v1/verifiers \
  -H "Authorization: Bearer your-internal-api-key"

# 测试统计数据接口
curl -X GET "http://localhost:3000/api/internal/v1/analytics?type=overview" \
  -H "Authorization: Bearer your-internal-api-key"
```

### 3.2 健康检查

```bash
curl http://localhost:3000/api/health
```

---

## 4. 可用 API 端点

### 4.1 文章 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/internal/v1/articles` | POST | 创建文章（支持批量、支持验证记录） |
| `/api/internal/v1/articles/[id]` | GET | 获取文章详情 |
| `/api/internal/v1/articles/[id]` | PUT | 更新文章 |
| `/api/internal/v1/articles/[id]` | DELETE | 删除文章 |
| `/api/internal/v1/articles/[id]/publish` | POST | 发布文章 |
| `/api/internal/v1/articles/[id]/verify` | POST | 添加验证记录 |

### 4.2 验证人 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/internal/v1/verifiers` | GET | 获取验证人列表 |
| `/api/internal/v1/verifiers` | POST | 创建验证人 |
| `/api/internal/v1/verifiers/[id]` | GET/PUT/DELETE | 验证人 CRUD |

### 4.3 统计 API

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/internal/v1/analytics` | GET | 获取统计数据 |

---

## 5. 创建文章（含验证记录）

### 5.1 基本创建

```bash
curl -X POST http://localhost:3000/api/internal/v1/articles \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": { "zh": "文章标题", "en": "Article Title" },
    "summary": { "zh": "文章摘要", "en": "Article Summary" },
    "content": { "zh": "文章内容...", "en": "Content..." },
    "domain": "agent",
    "createdBy": "agent-name"
  }'
```

### 5.2 带验证记录创建

```bash
curl -X POST http://localhost:3000/api/internal/v1/articles \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": { "zh": "文章标题", "en": "Article Title" },
    "summary": { "zh": "文章摘要", "en": "Article Summary" },
    "content": { "zh": "文章内容...", "en": "Content..." },
    "domain": "agent",
    "createdBy": "agent-name",
    "verificationRecords": [{
      "verifierId": "ver_xxx",
      "result": "passed",
      "environment": {
        "os": "macOS 14.0",
        "runtime": "Node.js",
        "version": "20.10.0"
      },
      "notes": "验证通过"
    }]
  }'
```

### 5.3 验证记录字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `verifierId` | string | 是 | 验证人 ID |
| `result` | enum | 是 | 验证结果: `passed`, `failed`, `partial` |
| `environment.os` | string | 是 | 操作系统 |
| `environment.runtime` | string | 是 | 运行时环境 |
| `environment.version` | string | 是 | 版本号 |
| `notes` | string | 否 | 备注 |

---

## 6. 已接入 Agent

### 6.1 Openclaw Workspace

**工作区路径**: `/Users/lilin/.openclaw/workspace-buzhou-product`

**环境变量配置** (`env.sh`):

```bash
# Buzhou Internal API Key
export INTERNAL_API_KEY="buzhou_internal_91274d04a3864bc5a6b91dc6088dbc4e57b65adbf65ee487"
```

**使用方式**:

```bash
# 加载环境变量
source /Users/lilin/.openclaw/workspace-buzhou-product/env.sh

# 调用 API
curl -X POST http://localhost:3000/api/internal/v1/articles \
  -H "Authorization: Bearer $INTERNAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

**配置文件**:
- `buzhou_features.json` - 功能列表，`base_url: "http://localhost:3000"`
- `test_cases.json` - 测试用例，`base_url: "http://localhost:3000"`

---

## 7. Agent 接入示例

### 7.1 TypeScript 客户端

```typescript
// buzhou-client.ts
const BASE_URL = 'http://localhost:3000'
const API_KEY = process.env.INTERNAL_API_KEY || 'your-internal-api-key'

interface LocalizedString {
  zh: string
  en: string
}

interface VerificationRecordInput {
  verifierId: string
  result: 'passed' | 'failed' | 'partial'
  environment: {
    os: string
    runtime: string
    version: string
  }
  notes?: string
}

interface CreateArticleData {
  title: LocalizedString
  summary: LocalizedString
  content: LocalizedString
  domain: ArticleDomain
  priority?: 'P0' | 'P1'
  createdBy: string
  tags?: string[]
  codeBlocks?: CodeBlock[]
  metadata?: Record<string, unknown>
  qaPairs?: QAPair[]
  relatedIds?: string[]
  skipVerification?: boolean
  verificationRecords?: VerificationRecordInput[]
}

// 文章领域分类
type ArticleDomain =
  // 原有领域分类
  | 'agent' | 'mcp' | 'skill'
  // MVP 内容分类
  | 'foundation' | 'transport'
  | 'tools-filesystem' | 'tools-postgres' | 'tools-github'
  | 'error-codes' | 'scenarios'

async function callApi(path: string, options: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} - ${JSON.stringify(data)}`)
  }

  return data
}

// 创建文章（含验证记录）
export async function createArticle(data: CreateArticleData) {
  return callApi('/api/internal/v1/articles', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// 批量创建文章
export async function createArticles(articles: CreateArticleData[]) {
  return callApi('/api/internal/v1/articles', {
    method: 'POST',
    body: JSON.stringify(articles),
  })
}

// 获取验证人列表
export async function listVerifiers(params?: {
  type?: 'official_bot' | 'third_party_agent' | 'human_expert'
  status?: 'active' | 'suspended' | 'retired'
  page?: number
  pageSize?: number
}) {
  const query = new URLSearchParams()
  if (params?.type) query.set('type', params.type)
  if (params?.status) query.set('status', params.status)
  if (params?.page) query.set('page', String(params.page))
  if (params?.pageSize) query.set('pageSize', String(params.pageSize))

  return callApi(`/api/internal/v1/verifiers?${query.toString()}`)
}

// 获取统计数据
export async function getAnalytics(params?: {
  type?: 'overview' | 'traffic' | 'api' | 'articles' | 'all'
  startDate?: string
  endDate?: string
}) {
  const query = new URLSearchParams()
  if (params?.type) query.set('type', params.type)
  if (params?.startDate) query.set('startDate', params.startDate)
  if (params?.endDate) query.set('endDate', params.endDate)

  return callApi(`/api/internal/v1/analytics?${query.toString()}`)
}
```

### 7.2 Python 客户端

```python
# buzhou_client.py
import os
import requests
from typing import Optional, Dict, List

BASE_URL = "http://localhost:3000"
API_KEY = os.getenv("INTERNAL_API_KEY", "your-internal-api-key")

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def create_article(
    title: Dict[str, str],
    summary: Dict[str, str],
    content: Dict[str, str],
    domain: str,
    created_by: str,
    tags: Optional[List[str]] = None,
    skip_verification: bool = False
):
    """创建文章"""
    data = {
        "title": title,
        "summary": summary,
        "content": content,
        "domain": domain,
        "createdBy": created_by,
        "skipVerification": skip_verification
    }
    if tags:
        data["tags"] = tags

    response = requests.post(
        f"{BASE_URL}/api/internal/v1/articles",
        json=data,
        headers=HEADERS
    )
    return response.json()

def list_verifiers(
    verifier_type: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20
):
    """获取验证人列表"""
    params = {"page": page, "pageSize": page_size}
    if verifier_type:
        params["type"] = verifier_type
    if status:
        params["status"] = status

    response = requests.get(
        f"{BASE_URL}/api/internal/v1/verifiers",
        params=params,
        headers=HEADERS
    )
    return response.json()

# 使用示例
if __name__ == "__main__":
    # 创建测试文章
    result = create_article(
        title={"zh": "测试文章", "en": "Test Article"},
        summary={"zh": "测试摘要", "en": "Test Summary"},
        content={"zh": "内容...", "en": "Content..."},
        domain="agent",
        created_by="python-agent"
    )
    print("创建结果:", result)
```

---

## 8. 常见问题

### Q1: 启动报错 "Cannot find module"

```bash
# 重新安装依赖
rm -rf node_modules
npm install
```

### Q2: 数据库未初始化

```bash
# 初始化数据库
npm run db:push

# 填充种子数据（可选）
npm run db:seed
```

### Q3: API 返回 401 Unauthorized

检查以下几点：
1. `.env` 文件中是否配置了 `INTERNAL_API_KEY`
2. 请求头是否正确设置 `Authorization: Bearer <key>`
3. API Key 是否与 `.env` 中配置的一致

### Q4: 端口被占用

```bash
# 查看端口占用
lsof -i :3000

# 使用其他端口
PORT=3001 npm run dev
```

---

## 9. 调试技巧

### 9.1 查看请求日志

开发环境下，API 请求会输出到控制台：

```
[API] POST /api/internal/v1/articles - 201 - 45ms
```

### 9.2 查看数据库数据

```bash
# 使用 Prisma Studio 查看数据
npx prisma studio
```

### 9.3 测试单个 API

```bash
# 使用 httpie (更友好的 curl 替代)
http POST localhost:3000/api/internal/v1/articles \
  Authorization:"Bearer your-key" \
  title:='{"zh":"测试","en":"Test"}' \
  summary:='{"zh":"摘要","en":"Summary"}' \
  content:='{"zh":"内容","en":"Content"}' \
  domain=agent \
  createdBy=test
```

---

## 10. 数据类型定义

详细的类型定义请参考 [正式环境文档](./INTERNAL_API.md#4-数据类型定义)。

---

## 相关文档

- [正式环境接入指南](./INTERNAL_API.md) - 生产环境接入
- [部署方案](./DEPLOYMENT.md) - 环境部署配置

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-03-07 | 初始版本，从正式环境文档分离 |
| 1.1.0 | 2026-03-07 | 添加内网穿透公网地址 |
| 1.2.0 | 2026-03-07 | 添加验证记录 API 文档 |
| 1.3.0 | 2026-03-08 | 添加 Openclaw 接入配置，Openclaw 改为本地直连方式 |