# SchemaOrg 构建错误修复方案

## 问题
Vercel 构建失败的根因不是页面导入语法，而是 `/Users/lilin/project/buzhou/src/components/shared/schema-org.tsx` 被错误覆盖成了首页组件代码，导致 `SchemaOrg`、`getOrganizationSchema`、`getWebsiteSchema`、`getArticleSchema`、`getTechArticleSchema`、`getBreadcrumbSchema`、`getFAQPageSchema`、`getAPIReferenceSchema` 等导出全部丢失。

## 最小修复范围
1. 恢复 `/Users/lilin/project/buzhou/src/components/shared/schema-org.tsx`
- 以最近一个正确版本为基准，恢复真正的 Schema.org JSON-LD 组件与导出函数。
- 不改页面调用方式，优先让现有引用重新成立。

2. 本地验证
- 在项目根目录执行 `npm --prefix /Users/lilin/project/buzhou run build`
- 若仍有类型错误，再只修与本次导出恢复直接相关的一处调用；不扩散到无关文件。

## 验收标准
- `SchemaOrg` 及相关 schema helper 可正常导入
- 本地 `next build` 通过
- 不引入额外功能改动

## 风险
- 如果 `src/app/[lang]/page.tsx` 近期又改过 `SchemaOrg` 的 props 约定，恢复文件后可能暴露第二个小问题；届时只做最小兼容修正。
