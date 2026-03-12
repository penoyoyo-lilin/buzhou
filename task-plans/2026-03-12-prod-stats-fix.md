# 任务方案：线上管理后台统计 500 + 前台统计口径修复

## 问题
1. 线上管理后台 `/api/admin/stats?period=day` 返回 500。
2. 线上前台首页统计区数据错误。
3. 控制台出现 `mcs.zijieapi.com/list` 的 `ERR_CONNECTION_CLOSED`。

## 初步判断
- `mcs.zijieapi.com` 请求来自第三方脚本/浏览器扩展，与本站核心 API 逻辑大概率无关（可作为噪音隔离）。
- `/api/admin/stats` 目前强依赖 `apiRequestLog/pageViewLog` 两张表，若生产库缺失、未迁移或字段不一致，会直接抛异常导致 500。
- `/api/v1/stats` 的 `apiRequests.total` 取自 `agentApp.totalRequests` 聚合，口径与真实请求日志可能不一致，导致首页统计失真。

## 子任务拆分（每次 <= 3 文件）

### 子任务 A：修复管理后台统计 API 的容错能力
- 文件：
  - `src/app/api/admin/stats/route.ts`
  - `tests/integration/api/admin-stats-resilience.test.ts`（新增）
- 目标：
  - 当日志表不可用/查询失败时，返回降级数据而非 500。
  - 仅保留真正不可恢复错误为 500（带可追踪日志）。

### 子任务 B：修复前台统计 API 口径
- 文件：
  - `src/app/api/v1/stats/route.ts`
  - `tests/integration/api/public-stats-accuracy.test.ts`（新增）
- 目标：
  - 优先使用真实日志口径（如可用）；不可用时有明确 fallback 逻辑。
  - 保证字段结构稳定，不影响前端渲染。

### 子任务 C：前端防御性展示与错误隔离
- 文件：
  - `src/components/shared/data-wall.tsx`
  - `src/app/admin/stats/page.tsx`
- 目标：
  - API 失败时展示可理解的降级 UI，不出现错误数据闪动。
  - 明确区分“本地 API 错误”和“第三方脚本噪音”。

## 验收标准
1. `/api/admin/stats?period=day` 在日志表异常场景不再返回 500，至少返回结构化降级数据。
2. 首页统计区核心数字与后端统计口径一致（并在日志不可用时符合 fallback 预期）。
3. 新增测试覆盖：
   - 管理后台统计接口容错
   - 前台统计口径正确性
   - 前端降级展示行为
4. 保持 domain/status 等既有契约不回退。

## 测试计划
- 单元/集成：
  - `npm --prefix /Users/lilin/project/buzhou run test -- tests/integration/api/admin-stats-resilience.test.ts tests/integration/api/public-stats-accuracy.test.ts`
- 全量回归：
  - `npm --prefix /Users/lilin/project/buzhou run test`
- 必要时补充 E2E：
  - 管理后台统计页加载与降级提示
  - 首页统计区加载与兜底展示

## 风险
- 生产数据库真实 schema 可能与当前本地不一致，需要通过错误日志精确确认。
- 若缺表来自迁移遗漏，最终仍需补充生产迁移流程。
