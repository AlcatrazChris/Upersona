-- 添加城市级别字段（可重复执行）
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS city_tier TEXT;

-- 创建索引以加快按城市级别分析
CREATE INDEX IF NOT EXISTS users_city_tier_idx ON users (city_tier, data_version);

-- 更新说明：
-- city_tier 取值：一线 | 新一线 | 二线 | 三线 | 四线及以下
-- 由上传路由根据 region_city 自动计算，存量数据可暂为 NULL
-- 如需回填存量数据，请在应用层通过 /api/admin/backfill-city-tier 接口操作
