1. 在编写代码前，先创建CLAUDE.md文件描述方案并等待批准。若需求不明确，需优先提出具体澄清问题。
2. 若任务需修改超过3个文件，立即暂停并拆分为更小的子任务，明确每个子任务的范围和依赖关系。
3. 完成代码后主动列出潜在问题，并设计针对性测试用例覆盖这些场景。
4. 发现Bug时，先编写能复现问题的测试用例，持续修复直至测试通过。
5. 每次我纠正你之后，在CLAUDE.md中新增规则以避免同类问题复发。
6. 需求出现调整，需要同时更新相关文档和测试脚本。
7. 测试脚本要覆盖所有主要功能和接口：
    - 单元测试和集成测试要覆盖所有接口
    - E2E测试要覆盖所有主要流程和交互细节
8. 执行 Bash 命令时，必须确认当前工作目录是否正确。本项目根目录为 `/Users/lilin/project/buzhou`，可使用 `npm --prefix /Users/lilin/project/buzhou` 或 `cd /Users/lilin/project/buzhou &&` 确保在正确目录执行命令。
9. **发布操作必须设置时间戳**：任何"发布"类操作（如文章发布、内容上线）必须同时设置 `published_at`/`publishedAt` 时间戳字段，不能仅更新状态字段。
10. **状态变更应触发相关事件**：发布、创建等关键状态变更应通过事件系统触发后续处理（如 AI 生成、通知推送），避免遗漏业务逻辑。
11. **数据完整性验证**：测试用例需验证关键字段的完整性，如发布后 `published_at` 不为空、状态字段正确等。
12. **文档与代码一致性**：当发现文档（尤其是 llms.txt、API 文档等对外文档）描述的功能与代码实现不一致时，应优先实现文档描述的功能，而非修改文档降低预期。公开文档是对用户的承诺。
13. **llms.txt 作为功能规范**：llms.txt 是面向 AI Agent 的公开 API 文档，其中描述的接口和参数应视为功能需求。如发现功能缺失，应实现功能以满足文档承诺。
14. **事件驱动架构**：关键状态变更（发布、创建、验证等）应通过 `eventBus.emit()` 触发事件，由独立的事件处理器 (`src/core/events/handlers.ts`) 执行后续逻辑，实现业务解耦。
15. **并行异步任务**：多个独立的异步任务（如 AI 生成 QA 对、关键词、关联文章）应使用 `Promise.allSettled()` 并行执行，确保单个任务失败不影响其他任务。
16. **AI 生成去重检查**：事件处理器在执行 AI 生成任务前，应检查目标字段是否已有内容，避免重复生成浪费资源或覆盖已有数据。
17. **事件处理器日志格式**：使用统一的日志前缀如 `[ArticleEventHandler]` 并包含关键 ID（如 articleId），便于在服务器控制台追踪异步任务执行情况。
18. **Next.js 缓存问题预防**：重启服务器用npm run dev:clean

19. **Supabase + Vercel Serverless 数据库连接**：
    - Supabase 连接池（端口 6543）必须在 URL 中添加 `?pgbouncer=true` 参数
    - Prisma schema 的 `directUrl` 必须配置，可以让它指向同一个 `DATABASE_URL`
    - 直接连接（端口 5432）在 Vercel Serverless 环境中不稳定，应使用连接池

20. **Vercel Serverless 文件系统只读**：
    - ❌ 禁止使用 `fs.writeFileSync()` 等文件写入操作
    - ✅ 配置和动态数据应存储到数据库中
    - 环境变量应通过 Vercel 控制台配置，不能通过代码修改

21. **执行 Prisma 数据库命令**：
    - 必须在项目根目录 `/Users/lilin/project/buzhou` 下执行
    - 推送 schema 变更：`DATABASE_URL="..." npx prisma db push`
    - 连接生产数据库时使用完整的 URL（包含 pgbouncer=true）

22. **Prisma Schema 变更后必须重新生成客户端**：
    - 修改 `prisma/schema.prisma` 后必须运行 `npx prisma generate`
    - 否则会出现 `Property 'xxx' does not exist on type 'PrismaClient'` 错误
    - 在 Vercel 部署时会自动执行，本地开发需手动执行

23. **PostgreSQL 枚举类型操作**：
    - 比较枚举字段时需要类型转换：`WHERE domain::text = 'old-value'`
    - 更新枚举字段时需要类型转换：`SET domain = 'new-value'::"ArticleDomain"`
    - 添加新枚举值必须先执行：`ALTER TYPE "EnumName" ADD VALUE IF NOT EXISTS 'new_value'`
    - 使用 `$executeRawUnsafe` 执行包含枚举值的 SQL

24. **项目根目录执行命令**：
    - 本项目根目录为 `/Users/lilin/project/buzhou`
    - 执行 npm/npx 命令时使用 `npm --prefix /Users/lilin/project/buzhou`
    - 执行 git 命令时使用 `git -C /Users/lilin/project/buzhou`
    - 或使用 `cd /Users/lilin/project/buzhou && command`

25. **枚举命名使用下划线而非连字符**：
    - 数据库枚举值和代码中统一使用下划线：`tools_filesystem`
    - 避免使用连字符：`tools-filesystem`（会导致 Prisma 类型问题）
    - 如发现不一致数据，需编写迁移脚本修复

27. **服务器启动失败排查流程**：
    - 首先检查端口状态：`lsof -i :3000`
    - 立即查看日志：`tail -30 /tmp/next-dev.log`
    - 根据日志错误信息针对性修复，而非盲目重试
    - 常见错误：目录不对（ENOENT）、端口占用、环境变量缺失

28. **命令执行失败后禁止盲目重试**：
    - 失败后必须先查看错误日志或输出
    - 分析根本原因后再执行修复操作
    - 连续2次相同失败应停下来检查环境配置

29. **数据库环境区分**：
    - **开发环境**：使用 SQLite，配置在 `.env`
      - `DATABASE_URL="file:./data/buzhou.db"`
      - schema: `prisma/schema.sqlite.prisma`
    - **生产环境**：使用 PostgreSQL (Supabase)，配置在 `.env.local` 和 `.env.production`
      - `DATABASE_URL="postgresql://...?pgbouncer=true"`
      - schema: `prisma/schema.postgres.prisma`
    - **切换 schema**：`cp prisma/schema.sqlite.prisma prisma/schema.prisma && npx prisma generate`
    - **运行 seed**：SQLite 用 `.env`，PostgreSQL 用 `.env.local` 的环境变量

30. 修改（edit）文件之前要先读取（read）文件

31. **Internal API 密钥管理**：
    - 密钥存储在数据库 `system_configs` 表中，Admin 后台生成的密钥优先级最高
    - 重新生成密钥后，旧密钥立即失效，必须更新所有调用方
    - 认证时优先从数据库获取密钥，环境变量 `INTERNAL_API_KEY` 仅作为后备

32. **生产环境域名**：
    - 正确域名：`www.buzhou.io`
    - `www.buzhou.ai` 是域名转发服务，不指向 Vercel 服务器
    - API 调用必须使用 `https://www.buzhou.io/api/...`

33. **llms.txt 文档维护**：
    - 文档中的 API 参数必须与代码实现一致
    - domain 参数使用下划线格式：`tools_filesystem`、`tools_postgres`、`tools_github`
    - 文档描述的功能是公开承诺，发现不一致时应修复代码而非降低文档预期

34. **开发环境启动命令**：
    - 使用 `npm run dev` 启动（默认 SQLite）
    - 已配置自动切换 schema 和清理缓存，无需手动操作
    - 连接生产数据库使用 `npm run dev:postgres`
    - 不再需要手动执行 `cp schema` 或 `rm -rf .next`

35. **环境变量优先级**：
    - `.env.local` 优先级高于 `.env`
    - 开发时如需使用 SQLite，需确保 `.env.local` 不存在或不含 PostgreSQL 的 `DATABASE_URL`
    - 生产部署前确保 `.env.local` 配置正确

31. **Internal API 密钥管理**：
    - 密钥存储在数据库 `system_configs` 表中，Admin 后台生成的密钥优先级最高
    - 重新生成密钥后，旧密钥立即失效，必须更新所有调用方
    - 认证时优先从数据库获取密钥，环境变量 `INTERNAL_API_KEY` 仅作为后备

32. **生产环境域名**：
    - 正确域名：`www.buzhou.io`
    - `www.buzhou.ai` 是域名转发服务，不指向 Vercel 服务器
    - API 调用必须使用 `https://www.buzhou.io/api/...`

33. **llms.txt 文档维护**：
    - 文档中的 API 参数必须与代码实现一致
    - domain 参数使用下划线格式：`tools_filesystem`、`tools_postgres`、`tools_github`
    - 文档描述的功能是公开承诺，发现不一致时应修复代码而非降低文档预期

34. **开发环境启动命令**：
    - 使用 `npm run dev` 启动（默认 SQLite）
    - 已配置自动切换 schema 和清理缓存，无需手动操作
    - 连接生产数据库使用 `npm run dev:postgres`
    - 不再需要手动执行 `cp schema` 或 `rm -rf .next`

35. **环境变量优先级**：
    - `.env.local` 优先级高于 `.env`
    - 开发时如需使用 SQLite，需确保 `.env.local` 不存在或不含 PostgreSQL 的 `DATABASE_URL`
    - 生产部署前确保 `.env.local` 配置正确


