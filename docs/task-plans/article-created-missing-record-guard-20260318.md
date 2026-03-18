# article:created 删除后更新保护方案

## 问题确认

- 创建文章后，`article:created` 处理器会异步生成 QA、关键词、关联文章。
- 如果文章在异步任务执行期间被管理员或测试删除，处理器里的 `articleService.update(articleId, ...)` 会抛出“Record to update not found”。
- 当前这类情况会在开发日志里形成噪音，但不代表真正的业务故障。

## 目标

- 当文章已被删除时，异步 AI 更新应静默跳过。
- 保留其他真实错误日志，不把所有异常一概吞掉。

## 最小实现范围

限制在 2 个文件内：

1. `src/core/events/handlers.ts`
2. `tests/integration/api/internal-articles-create.test.ts`

## 实现思路

### 子任务 1：事件处理器加缺失记录保护

- 在 `article:created` 处理器中增加一个小的辅助函数：
  - 包装 `articleService.update(articleId, patch)`
  - 若命中“记录不存在”错误，则输出一条轻量 `warn` 日志并返回
  - 其他错误继续抛出，保持原有可观测性
- 三处 AI 更新（QA、关键词、关联文章）都统一走这个辅助函数。

### 子任务 2：补回归测试

- 在 `tests/integration/api/internal-articles-create.test.ts` 中补一条最小用例：
  - 创建文章
  - 立即删除文章
  - 断言不会因为异步 `article:created` 更新而把流程打成失败
- 这条测试不追求捕获所有日志，只验证删除后的链路能平稳完成。

## 验收标准

- 删除文章后，异步 `article:created` 更新不再打出 `Record to update not found` 级别错误。
- QA/关键词/关联文章正常场景仍会继续更新。
- integration 回归通过。

## 风险与关注点

1. 只能静默处理“记录不存在”，不能吞掉其他更新错误。
2. 该保护只覆盖 `article:created` 处理器；若其他异步链路也会更新已删除文章，需要后续分别补齐。
