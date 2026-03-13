# 文章链接渲染与开发环境静态资源 404 修复方案

## 子任务 1：文章正文链接渲染

### 问题确认

- 当前文章详情页 HTML 视图直接以纯文本方式输出正文。
- 标准 Markdown 链接不会被渲染为 `<a>`。
- 裸网址也不会自动识别为超链。

### 修复范围

控制在 3 个文件内：

1. `src/services/render.service.ts`
2. `src/app/[lang]/articles/[slug]/page.tsx`
3. 1 个现有测试文件

### 修复思路

1. 让详情页 HTML 视图复用 `renderService` 的 HTML 渲染能力，而不是直接输出纯文本。
2. 在 `render.service.ts` 为正文增加 URL 自动链接预处理：
   - 已有 Markdown 链接保持不变
   - 裸 `http://` / `https://` 自动转为链接
3. 保持 Markdown / JSON 视图契约不变，仅修正文详情 HTML 展示。

### 验收标准

- `[text](https://example.com)` 在详情页可点击。
- `https://example.com` 在详情页自动变为可点击链接。
- 普通文本换行和代码块展示不回退。

## 子任务 2：开发环境 `_next/static/*` 404

### 问题确认

- 当前开发环境存在静态 chunk / css 404。
- 历史日志已出现 `.next/server/vendor-chunks/*` 缺失。
- 这是 Next.js 开发产物异常，不是业务接口错误。

### 修复范围

- 优先无代码修复：
  - 停掉当前 dev 进程
  - 清理 `.next`
  - 使用项目约定的 `npm --prefix /Users/lilin/project/buzhou run dev:reset`
  - 重新验证 `/_next/static/*` 资源访问

### 验收标准

- `http://localhost:3000/zh` 页面可正常加载。
- 浏览器不再出现 `layout.css`、`main-app.js`、`app-pages-internals.js` 等 404。
- 日志中不再出现 `Cannot find module './vendor-chunks/*'`。
