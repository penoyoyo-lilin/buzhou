# 创建文章 AI 生成异步化方案

## 背景

- 当前 `admin` 与 `internal` 创建文章接口在主请求返回前，会额外 `await eventBus.emit('article:created', ...needsQAGeneration...)`。
- `article:created` 处理器会并行执行 QA、关键词、关联文章生成，并在 `Promise.allSettled()` 完成后才返回。
- 这导致“创建文章”主请求同步等待 AI 生成链路，开发环境已实测出现 `POST /api/admin/articles 200 in 75573ms`。
- 该行为已经影响 E2E 稳定性，也会影响真实后台体验。

## 目标

- 创建文章主请求不再同步等待 AI 生成链路。
- 仍然保留现有事件驱动架构与 AI 生成能力。
- 不改变“发布要写 `publishedAt`”和“发布触发巡检”等现有副作用。

## 最小实现思路

### 子任务 1：入口层改为 fire-and-forget

范围限制在 2 个文件：

1. `src/app/api/admin/articles/route.ts`
2. `src/app/api/internal/v1/articles/route.ts`

做法：

- 保留现有 `eventBus.emit('article:created', ...)` 的 payload 不变。
- 但不再 `await`，改为：
  - `void eventBus.emit(...).catch(...)`
- 补统一日志前缀，记录 articleId 和 source，避免异步触发失败被吞掉后难排查。

预期：

- admin/internal 创建接口响应时间恢复到“创建/发布本身”的量级。
- AI 生成仍会异步执行。

### 子任务 2：测试与回归

范围限制在 1 个文件：

1. `tests/integration/api/internal-articles-create.test.ts`

做法：

- 去掉为了绕过慢链路而加的 `eventBus.emit` mock。
- 保留当前对创建后“已发布、可搜索、详情可读”的断言。
- 增加一个轻量断言：
  - 创建请求完成后，文章已落库且不会因等待 AI 生成而超时。

说明：

- 这一步先做 integration 回归，不扩大到更多 E2E 文件，控制改动面。
- E2E 再用现有套件整体回归，不为这次修复额外新增页面逻辑。

## 验收标准

- `POST /api/admin/articles` 不再同步阻塞几十秒。
- `POST /api/internal/v1/articles` 不再同步等待 AI 生成完成。
- 创建后文章仍然能：
  - 正确设置 `status/publishedAt`
  - 触发发布巡检
  - 后续异步生成 QA/关键词/相关文章
- integration 与现有 E2E 回归通过。

## 风险与关注点

1. 改成 fire-and-forget 后，AI 生成失败不会反馈到创建接口响应体，只能依赖日志排查。
2. 若事件处理器内部再触发更新事件，仍可能带来后续巡检/缓存失效链路，但这是既有行为，不是本次新增。
3. 若后续还存在其他写入口同步 `await eventBus.emit('article:created', ...)`，需要继续补齐。
