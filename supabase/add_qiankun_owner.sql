-- 新增"是否乾坤注册车主"列
-- 对应华为乾崑 APP 绑定车辆情况，标准值：'是' / '否'
-- 请在 Supabase SQL Editor 中执行此文件

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_qiankun_owner TEXT DEFAULT '';

-- 在 dimensions_config 中注册该维度（如尚未通过管理界面添加）
INSERT INTO dimensions_config
  (dim_key, label, is_ordered, is_multi_select, field_type,
   enabled_profile, enabled_insight, sort_order)
VALUES
  ('is_qiankun_owner', '乾坤注册车主', FALSE, FALSE, 'category',
   TRUE, TRUE, 150)
ON CONFLICT (dim_key) DO NOTHING;
