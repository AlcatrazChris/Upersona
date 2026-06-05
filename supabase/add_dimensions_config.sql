-- 维度配置表：替代代码中的 PROFILE_DIMENSIONS 硬编码
-- 可重复执行（ON CONFLICT DO NOTHING）

CREATE TABLE IF NOT EXISTS dimensions_config (
  id              SERIAL PRIMARY KEY,
  dim_key         TEXT NOT NULL UNIQUE,
  label           TEXT NOT NULL,
  is_ordered      BOOLEAN NOT NULL DEFAULT false,
  is_multi_select BOOLEAN NOT NULL DEFAULT false,
  ordered_values  TEXT[] DEFAULT NULL,
  note            TEXT DEFAULT NULL,
  field_type      TEXT NOT NULL DEFAULT 'category',  -- text | category | multi
  enabled_profile BOOLEAN NOT NULL DEFAULT true,     -- 用户画像 / 状态对比 / 概览
  enabled_insight BOOLEAN NOT NULL DEFAULT true,     -- 参与 AI 洞察分析
  sort_order      INT NOT NULL DEFAULT 100,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dimensions_config ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dimensions_config' AND policyname = 'service role full access'
  ) THEN
    CREATE POLICY "service role full access" ON dimensions_config
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 允许匿名读取（前端页面需要加载维度配置）
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dimensions_config' AND policyname = 'anon read'
  ) THEN
    CREATE POLICY "anon read" ON dimensions_config
      FOR SELECT USING (true);
  END IF;
END $$;

-- 种子数据（从 PROFILE_DIMENSIONS 迁移）
INSERT INTO dimensions_config (dim_key, label, is_ordered, is_multi_select, ordered_values, note, field_type, enabled_profile, enabled_insight, sort_order) VALUES
  ('age_group',             '年龄段',              true,  false, '{50岁以上,45-49岁,40-44岁,35-39岁,30-34岁,30岁以下}',                              NULL,                     'category', true,  true,  10),
  ('education',             '学历',                true,  false, '{博士,硕士,本科,大专,高中/中专及以下}',                                               NULL,                     'category', true,  true,  20),
  ('occupation_category',   '职业',                false, false, NULL,                                                                               NULL,                     'category', true,  true,  30),
  ('family_structure',      '家庭结构',            true,  false, '{六口及以上,五口之家,四口之家,三口之家,两口之家,单身}',                               NULL,                     'category', true,  true,  40),
  ('annual_income',         '家庭年收入',          true,  false, '{50万以上,40-49万,30-39万,24-29万,20-24万,15-19万,15万以下}',                        NULL,                     'category', true,  true,  50),
  ('is_upgrade',            '是否增换购',          false, false, NULL,                                                                               NULL,                     'category', true,  true,  60),
  ('consumption_views',     '消费观念',            false, true,  NULL,                                                                               '多选题，总和 > 100%',    'multi',    true,  true,  70),
  ('use_scenarios',         '用车场景',            false, true,  NULL,                                                                               '多选题，总和 > 100%',    'multi',    true,  true,  80),
  ('family_trip_frequency', '与老人小孩出行频率',  true,  true,  '{频繁，平均一周一次,较频繁，平均每月一次,较少，平均半年一次,很少，平均一年一次}',     '多选题，总和 > 100%',    'multi',    true,  true,  90),
  ('info_channels',         '了解华境S的渠道',     false, true,  NULL,                                                                               '多选题，总和 > 100%',    'multi',    true,  true,  100),
  ('car_interests',         '关注的汽车内容',      false, true,  NULL,                                                                               '多选题，总和 > 100%',    'multi',    true,  true,  110),
  ('hobbies',               '日常爱好',            false, true,  NULL,                                                                               '多选题，总和 > 100%',    'multi',    true,  true,  120),
  ('competing_models',      '对比车型',            false, true,  NULL,                                                                               '多选题，总和 > 100%',    'multi',    false, true,  130),
  ('city_tier',             '城市级别',            true,  false, '{一线城市,新一线城市,二线城市,三线城市,四线及以下城市}',                              NULL,                     'category', true,  true,  140)
ON CONFLICT (dim_key) DO NOTHING;
