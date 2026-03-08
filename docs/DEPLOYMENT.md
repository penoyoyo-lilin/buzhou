# 不周山（buzhou）正式环境部署方案

> 版本: 1.0.0 | 日期: 2026-03-07

---

## 背景

本项目目前使用 **SQLite + 内存缓存** 进行本地开发测试，需要部署到正式环境。正式环境需要：
- **PostgreSQL** 作为主数据库（支持高并发、复杂查询）
- **Redis** 作为缓存服务
- **Vercel** 作为部署平台
- **Cloudflare** 作为 CDN 和 DDoS 防护

**关键要求**：本地测试环境配置需保留，支持环境切换。

---

## 环境对比

| 组件 | 本地开发环境 | 正式生产环境 |
|------|-------------|-------------|
| 数据库 | SQLite (file:./data/buzhou.db) | PostgreSQL (Neon/Supabase) |
| 缓存 | 内存缓存 (DISABLE_REDIS=true) | Redis (Upstash) |
| 部署 | 本地 npm run dev | Vercel Edge |
| CDN | 无 | Cloudflare |
| 域名 | localhost:3000 | buzhou.io |

---

## 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                    正式环境架构                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│  │ Cloudflare  │────►│   Vercel    │────►│ PostgreSQL  │   │
│  │    CDN      │     │  Edge/SSR   │     │   (Neon)    │   │
│  └─────────────┘     └─────────────┘     └─────────────┘   │
│         │                   │                               │
│         │                   ▼                               │
│         │            ┌─────────────┐                        │
│         │            │    Redis    │                        │
│         │            │  (Upstash)  │                        │
│         │            └─────────────┘                        │
│         │                                                  │
│         ▼                                                  │
│  ┌─────────────┐                                          │
│  │  静态资源   │                                          │
│  └─────────────┘                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 阶段 1：Prisma Schema 适配

### 1.1 创建 PostgreSQL Schema

**文件**: `prisma/schema.postgres.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_DIRECT_URL")
}

// 枚举定义（PostgreSQL 原生支持）
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

enum AgentStatus {
  active
  suspended
  revoked
}

enum AdminRole {
  super_admin
  admin
  editor
  viewer
}

enum AdminStatus {
  active
  suspended
  deleted
}

// ... 其他模型与现有 schema 相同
```

### 1.2 保留 SQLite Schema

将当前 `prisma/schema.prisma` 重命名为 `prisma/schema.sqlite.prisma`

### 1.3 添加环境切换脚本

```json
// package.json 新增脚本
{
  "scripts": {
    "db:use:sqlite": "cp prisma/schema.sqlite.prisma prisma/schema.prisma && prisma generate",
    "db:use:postgres": "cp prisma/schema.postgres.prisma prisma/schema.prisma && prisma generate",
    "db:migrate:prod": "prisma migrate deploy"
  }
}
```

---

## 阶段 2：环境变量配置

### 2.1 本地环境 (`.env`) - 保持不变

```bash
# 数据库连接 (SQLite 本地开发)
DATABASE_URL="file:./data/buzhou.db"

# 禁用 Redis (使用内存缓存)
DISABLE_REDIS="true"

# 应用密钥
NEXTAUTH_SECRET="local-dev-secret"

# 内部 API 密钥
INTERNAL_API_KEY="local-internal-api-key"

# 管理员默认密码
ADMIN_DEFAULT_PASSWORD="admin123456"
```

### 2.2 正式环境 (`.env.production`)

```bash
# PostgreSQL 连接 (Neon)
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/buzhou?sslmode=require"
DATABASE_DIRECT_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/buzhou?sslmode=require"

# Redis 连接 (Upstash)
REDIS_URL="rediss://default:password@xxx.upstash.redis.io:6379"
DISABLE_REDIS="false"

# 应用密钥（生产环境必须更改！）
NEXTAUTH_SECRET="production-secret-change-me"

# 内部 API 密钥
INTERNAL_API_KEY="production-internal-api-key"

# 正式环境标识
NODE_ENV="production"
```

### 2.3 Vercel 环境变量配置

在 Vercel Dashboard 中配置：

| 变量名 | 值 | 环境 |
|--------|-----|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | Production |
| `DATABASE_DIRECT_URL` | PostgreSQL 直连 URL | Production |
| `REDIS_URL` | Upstash Redis URL | Production |
| `DISABLE_REDIS` | `false` | Production |
| `NEXTAUTH_SECRET` | 随机生成的密钥 | Production |
| `INTERNAL_API_KEY` | 内部 API 密钥 | Production |

---

## 阶段 3：服务层代码适配

### 3.1 Prisma 客户端更新

**文件**: `src/core/db/client.ts`

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Vercel 需要使用 directUrl
    datasourceUrl: process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
```

### 3.2 服务层 JSON 处理

PostgreSQL 支持原生 JSON 字段，需要：
- 恢复 `ArticleService` 使用原生 JSON（移除 SQLite 字符串序列化）
- 恢复 `VerificationService` 使用原生 JSON

### 3.3 缓存模块

`src/core/cache/index.ts` 已支持 Redis/内存缓存自动切换，无需修改。

---

## 阶段 4：Vercel 部署配置

### 4.1 `vercel.json`

```json
{
  "buildCommand": "prisma generate && next build",
  "devCommand": "next dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["sin1", "hnd1"],
  "functions": {
    "src/app/api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 10
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "X-Agent-API-Endpoint", "value": "https://buzhou.io/api/v1/resolve" },
        { "key": "X-Agent-API-Docs", "value": "https://buzhou.io/api-docs" }
      ]
    }
  ]
}
```

### 4.2 `.vercelignore`

```
node_modules
.next
.git
*.log
data/
tests/
```

---

## 阶段 5：Docker 部署方案（可选）

### 5.1 `Dockerfile`

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# 依赖安装
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# 构建
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate
RUN npm run build

# 运行
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### 5.2 `docker-compose.yml` (本地完整环境)

```yaml
# docker-compose.yml - 本地完整环境
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/buzhou
      - REDIS_URL=redis://redis:6379
      - NEXTAUTH_SECRET=your-secret-key
      - INTERNAL_API_KEY=your-internal-api-key
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=buzhou
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 5.3 `docker-compose.prod.yml` (生产环境)

```yaml
# docker-compose.prod.yml - 生产环境
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - INTERNAL_API_KEY=${INTERNAL_API_KEY}
      - NODE_ENV=production
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 阶段 6：CI/CD 配置

### 6.1 `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: buzhou_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/buzhou_test

      - name: Build
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

---

## 阶段 7：健康检查与监控

### 7.1 健康检查 API

**文件**: `src/app/api/health/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/core/db/client'
import { getCacheStatus } from '@/core/cache'

export async function GET() {
  const startTime = Date.now()

  try {
    // 检查数据库连接
    await prisma.$queryRaw`SELECT 1`

    // 获取缓存状态
    const cacheStatus = getCacheStatus()

    const responseTime = Date.now() - startTime

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      services: {
        database: 'connected',
        cache: cacheStatus,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
```

### 7.2 日志配置

```typescript
// src/lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'

export function log(level: LogLevel, message: string, data?: Record<string, unknown>) {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return

  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data && { data }),
  }

  console.log(JSON.stringify(logEntry))
}
```

---

## 阶段 8：Cloudflare 配置

### 8.1 DNS 配置

| 类型 | 名称 | 值 |
|------|------|-----|
| CNAME | @ | cname.vercel-dns.com |
| CNAME | www | cname.vercel-dns.com |
| CNAME | api | cname.vercel-dns.com |

### 8.2 Cloudflare 设置

| 设置项 | 值 |
|--------|-----|
| SSL/TLS | Full (Strict) |
| Always Use HTTPS | On |
| Auto Minify | HTML, CSS, JavaScript |
| Brotli | On |
| Rocket Loader | Off |
| Security Level | Medium |

---

## 关键文件清单

| 文件 | 用途 |
|------|------|
| `prisma/schema.postgres.prisma` | PostgreSQL schema |
| `prisma/schema.sqlite.prisma` | SQLite schema (本地) |
| `.env.production` | 正式环境变量模板 |
| `vercel.json` | Vercel 配置 |
| `Dockerfile` | Docker 镜像 |
| `docker-compose.yml` | 本地 Docker 环境 |
| `docker-compose.prod.yml` | 生产 Docker 环境 |
| `.github/workflows/deploy.yml` | CI/CD |
| `src/app/api/health/route.ts` | 健康检查 |
| `src/lib/logger.ts` | 日志工具 |

---

## 部署检查清单

### 部署前检查

- [ ] 更新 `.env.production` 中的所有密钥
- [ ] 运行数据库迁移 `npx prisma migrate deploy`
- [ ] 执行种子数据 `npm run db:seed`
- [ ] 确认所有测试通过 `npm test`
- [ ] 检查 TypeScript 错误 `npx tsc --noEmit`

### 部署后检查

- [ ] 访问健康检查端点 `/api/health`
- [ ] 验证数据库连接
- [ ] 验证 Redis 连接
- [ ] 测试内部 API 认证
- [ ] 检查 CDN 缓存
- [ ] 配置日志监控

---

## 回滚方案

### Vercel 回滚

```bash
# 回滚到上一个部署
vercel rollback

# 回滚到特定部署
vercel rollback [deployment-url]
```

### 数据库回滚

```bash
# 回滚到上一个迁移
npx prisma migrate resolve --rolled-back [migration_name]
```

---

## 预估成本（月度）

| 服务 | 方案 | 预估成本 |
|------|------|---------|
| Vercel | Pro | $20/月 |
| Neon | Pro | $19/月 |
| Upstash | Pay as you go | ~$10/月 |
| Cloudflare | Pro | $20/月 |
| **总计** | | **~$70/月** |

**免费方案（低流量）**：
- Vercel Hobby: 免费
- Neon Free Tier: 免费 (0.5GB)
- Upstash Free Tier: 免费 (10K commands/day)
- Cloudflare Free: 免费

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2026-03-07 | 初始版本 |