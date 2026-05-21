-- ============================================================
-- 职业问题诊断 + 修复脚本
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- Step 1: 诊断 - 查看当前所有版本
SELECT version_id, uploaded_at, record_count, is_active FROM data_versions ORDER BY version_id;

-- Step 2: 诊断 - 查看当前激活版本的职业分布
SELECT occupation_category, COUNT(*) as cnt
FROM users
WHERE data_version = (SELECT version_id FROM data_versions WHERE is_active = true ORDER BY version_id DESC LIMIT 1)
GROUP BY occupation_category
ORDER BY cnt DESC;

-- Step 3: 诊断 - 查看 occupation_mapping 里存的分类
SELECT DISTINCT category FROM occupation_mapping ORDER BY category;

-- Step 4: 彻底清空重来（执行后再运行 seed.mjs）
DELETE FROM predictions_cache;
DELETE FROM insights_cache;
DELETE FROM users;
DELETE FROM data_versions;
DELETE FROM occupation_mapping;

-- 重置序列
ALTER SEQUENCE IF EXISTS data_versions_version_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS users_id_seq RESTART WITH 1;

-- 验证
SELECT 'users' as tbl, COUNT(*) as cnt FROM users
UNION ALL SELECT 'data_versions', COUNT(*) FROM data_versions
UNION ALL SELECT 'occupation_mapping', COUNT(*) FROM occupation_mapping;
