-- 为 dimensions_config 表添加图表类型和字段分组列
-- 在 Supabase SQL Editor 执行一次即可

ALTER TABLE dimensions_config
  ADD COLUMN IF NOT EXISTS chart_type VARCHAR DEFAULT 'bar',
  ADD COLUMN IF NOT EXISTS group_name  VARCHAR DEFAULT '';

-- 更新注释
COMMENT ON COLUMN dimensions_config.chart_type IS '图表展示类型：bar（条形图）| pie（饼图）';
COMMENT ON COLUMN dimensions_config.group_name  IS '字段分组标签，如：基本信息、消费行为、渠道偏好。空字符串表示未分组';
