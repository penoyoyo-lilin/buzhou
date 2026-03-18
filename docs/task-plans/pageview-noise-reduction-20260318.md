# Pageview 日志噪音收敛方案

## 问题确认

- `POST /api/v1/pageview` 当前在 `await request.json()` 失败时会直接进入 `catch`，并输出 `console.error('Pageview record error:', error)`。
- 浏览器、测试或异常请求在 body 为空/非 JSON 时，会触发 `Unexpected end of JSON input` 这类日志。
- 该接口本身设计为“静默失败，不影响用户体验”，因此这类输入级异常不应继续作为错误日志刷屏。

## 修复范围

限制在 2 个文件内：

1. `src/app/api/v1/pageview/route.ts`
2. `tests/integration/api/public-agent-auto-registration.test.ts`

## 修复思路

1. 在 pageview 路由中把请求体解析改为受控处理：
   - 对空 body / 非 JSON body 做安全解析
   - 这类情况直接返回 `{ recorded: false }` 或按缺少 `path` 的 400 处理
   - 不输出 `console.error`
2. 保留真正数据库写入失败等运行时异常的错误日志，避免把真实故障也静默掉。
3. 补一个集成测试：
   - 空 body 调用 `POST /api/v1/pageview`
   - 断言接口不会抛 500
   - 断言不会把这种情况当成服务异常路径

## 验收标准

- 空 body / 非 JSON 请求不会再产生日志噪音 `Unexpected end of JSON input`。
- 正常 pageview 写入行为不受影响。
- 真实数据库写入错误仍会被记录。

## 风险与关注点

- 不能为了消除日志噪音把所有异常都静默掉，数据库类失败仍需保留错误日志。
- 若测试里直接断言日志输出，需要避免和其他公开 API 跟踪日志混淆。
