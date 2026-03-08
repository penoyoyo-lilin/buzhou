-- ============================================
-- 数据修复脚本
-- 用于修复线上污染数据
-- 执行前请先备份数据库！
-- ============================================

-- 1. 修复 domain 字段命名（连字符改下划线）
UPDATE articles
SET domain = 'tools_filesystem'
WHERE domain = 'tools-filesystem';

UPDATE articles
SET domain = 'tools_postgres'
WHERE domain = 'tools-postgres';

UPDATE articles
SET domain = 'tools_github'
WHERE domain = 'tools-github';

UPDATE articles
SET domain = 'error_codes'
WHERE domain = 'error-codes';

-- 2. 修复 published_at 为空但状态为 published 的文章
UPDATE articles
SET published_at = created_at
WHERE status = 'published' AND published_at IS NULL;

-- 3. 验证 domain 值是否都在合法范围内
SELECT id, domain
FROM articles
WHERE domain NOT IN (
  'agent', 'mcp', 'skill',
  'foundation', 'transport',
  'tools_filesystem', 'tools_postgres', 'tools_github',
  'error_codes', 'scenarios'
);

-- 4. 检查孤儿验证记录（文章已被删除）
SELECT vr.id, vr.article_id
FROM verification_records vr
LEFT JOIN articles a ON vr.article_id = a.id
WHERE a.id IS NULL;

-- 5. 删除孤儿验证记录（可选，谨慎执行）
-- DELETE FROM verification_records
-- WHERE article_id NOT IN (SELECT id FROM articles);

-- 6. 检查 JSON 字段是否有效
SELECT id,
  CASE
    WHEN title IS NULL OR title = '' THEN 'title is null/empty'
    WHEN summary IS NULL OR summary = '' THEN 'summary is null/empty'
    WHEN content IS NULL OR content = '' THEN 'content is null/empty'
    ELSE 'ok'
  END as status
FROM articles
WHERE title IS NULL OR title = ''
   OR summary IS NULL OR summary = ''
   OR content IS NULL OR content = '';

-- ============================================
-- 执行完成后运行此命令验证
-- ============================================
SELECT
  COUNT(*) as total_articles,
  COUNT(CASE WHEN status = 'published' AND published_at IS NOT NULL THEN 1 END) as published_with_date,
  COUNT(CASE WHEN published_at IS NULL THEN 1 END) as null_published_at,
  COUNT(DISTINCT domain) as unique_domains
FROM articles;