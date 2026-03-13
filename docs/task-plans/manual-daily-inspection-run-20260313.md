# 巡检中心手动每日增量一键入队并执行方案

## 问题确认

- 当前后台已有“每日增量入队”按钮，但它只创建 `queued` run，不会在同一次操作里继续处理。
- 在不依赖定时任务的前提下，这会让用户还需要再额外点击“处理 5 条”，操作链路被拆成两步。
- 早期阶段更适合把现有手动动作做成一次点击完成“入队 + 执行”的闭环，而不是继续增加新的批量入口或调度器。

## 修复范围

限制在 3 个文件内：

1. `src/app/api/admin/inspections/route.ts`
2. `src/app/admin/inspections/page.tsx`
3. `tests/integration/api/article-inspection.routes.test.ts`

## 修复思路

1. 调整后台 `daily` 动作：
   - 先执行 `enqueueDailyIncrementalRun(limit)`
   - 再在同一次请求里执行 `processQueuedRuns(processLimit)`
   - 返回 `enqueued`、`processed` 和结果明细
2. 调整巡检中心页面文案与交互：
   - 将“每日增量入队”改为更明确的一键执行文案
   - 成功后刷新列表和队列统计
3. 保留现有“处理 5 条”按钮作为人工兜底，不新增新的批量运行入口

## 验收标准

- 点击手动每日增量按钮后，会在同一次后台请求中完成“生成队列 + 执行 run”。
- 执行后，新增的 run 不会全部停留在 `queued`。
- 现有“处理 5 条”能力保持不变，作为兜底能力继续可用。

## 测试计划

- 先补复现测试：
  - `POST /api/admin/inspections { action: "daily" }` 会同时返回 `enqueued` 和 `processed`
  - 调用后至少有一条新增 run 脱离 `queued`
  - `process` 动作现有行为不回归
- 页面交互验证：
  - 一键执行按钮调用成功后刷新列表
  - 队列统计同步更新

## 风险与关注点

- `daily` 动作现在既入队又执行，处理时长会比之前更长，按钮 loading 状态要清晰。
- 本次不恢复自动调度；若后续文章量明显增长，再评估是否把入队与处理重新拆开。
