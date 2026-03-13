# 管理后台关联文章生成修复方案

## 问题确认

- 管理后台文章编辑页点击“生成关联文章”后，会调用 `POST /api/admin/articles/[id]/generate`。
- 后端接口仅在 `aiService.generateRelatedIds()` 返回 `relatedIds.length > 0` 时才写入数据库。
- 当前 `src/services/ai.service.ts` 中，以下场景都会直接返回空数组：
  - `AI_API_URL` 或 `AI_API_KEY` 未配置
  - AI 调用失败
  - AI 返回格式解析失败
- 现有测试没有覆盖“AI 不可用时仍应生成可用关联文章”的场景。

## 修复范围

限制在 3 个文件内：

1. `src/services/ai.service.ts`
2. `src/app/api/admin/articles/[id]/generate/route.ts`
3. `tests/unit/admin-article-generate-related.test.ts`

## 修复思路

1. 在 `ai.service.ts` 为关联文章生成增加确定性兜底算法，不再完全依赖 AI。
2. 兜底算法按简单打分返回 1-5 篇候选：
   - 同 `domain` 加分
   - `tags` 重叠加分
   - 标题/摘要关键词重叠加分
   - 过滤当前文章自身
3. 生成流程优先使用 AI 结果：
   - AI 返回合法且非空时，直接使用 AI 结果
   - AI 未配置、失败、解析失败或结果为空时，自动回退到确定性算法
4. `generate` 接口保持现有契约不变，但补充测试验证落库结果。

## 验收标准

- 在 AI 未配置时，点击“生成关联文章”仍可为存在相近文章的内容生成 `relatedIds` 并成功落库。
- 在 AI 返回空或解析失败时，接口仍返回非空 `results.related`（前提是库中存在匹配文章）。
- 若确实没有可推荐文章，接口返回成功但 `results.related` 为空，不报错。
- 新增测试覆盖：
  - AI 未配置时的兜底生成
  - 生成接口会把 `relatedIds` 写回文章

## 风险与关注点

- 兜底算法必须稳定、可解释，避免随机结果导致测试不稳定。
- 不修改前端交互，避免扩大范围。
- 若发现接口层与服务层职责交叉，再单独拆子任务，不在本次一并扩写。
