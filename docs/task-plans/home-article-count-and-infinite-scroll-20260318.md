# 首页文章总数与下滑加载修复方案

## 问题确认

- 首页当前把 `articles.length` 当作“文章数量”展示，因此只会显示当前页拿到的数量。
- 首页请求 `/api/v1/search` 时固定 `pageSize=20`，所以无筛选时最多显示 20，而不是全部已发布文章。
- 用户希望：
  - 统计区显示真实文章总数
  - 文章列表区域能展示全量文章，并通过下滑加载逐步加载

## 修复范围

限制在 3 个文件内：

1. `src/app/[lang]/page.tsx`
2. `src/app/api/v1/search/route.ts`
3. `docs/task-plans/home-article-count-and-infinite-scroll-20260318.md`

## 修复思路

1. 首页状态拆分：
   - 文章列表 `articles`
   - 总数 `totalArticles`
   - 当前页 `page`
   - 是否还有下一页 `hasMore`
   - 是否正在追加加载 `isLoadingMore`
2. 首次加载与筛选变更时：
   - 重置为第 1 页
   - 使用接口返回的 `pagination.total` 更新统计区
   - 使用 `pagination.totalPages` / `items.length` 判断是否还有更多
3. 下滑加载：
   - 在列表底部加一个 sentinel
   - 用 `IntersectionObserver` 触发下一页加载
   - 后续页结果追加到现有 `articles`
4. 搜索接口校正：
   - 当存在 `q` 时，`pagination.total` 应反映过滤后的结果总数，而不是数据库未过滤总数
   - 避免首页统计和滚动分页在搜索场景下出现总数错误

## 验收标准

- 首页统计区显示真实匹配总数，而不是当前页数量。
- 无筛选时，向下滚动可逐步加载全部已发布文章。
- 搜索/领域/验证状态筛选后，统计区和列表都与当前筛选结果一致。
- 切换筛选条件后，列表会从第一页重新加载，不混入旧结果。

## 风险与关注点

- 当前搜索接口对 `q` 采用应用层过滤，因此需要同步修正 `pagination.total`，否则无限加载会提前结束或统计错误。
- 下滑加载要避免重复触发同一页请求，需要在前端用 `isLoadingMore` 和 `hasMore` 做保护。
