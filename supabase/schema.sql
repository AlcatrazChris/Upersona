-- ============================================================
-- huajing-persona 数据库 Schema
-- 在 Supabase 控制台 > SQL Editor 中执行此脚本
-- ============================================================

-- 启用 UUID 扩展（可选）
create extension if not exists "uuid-ossp";

-- ============================================================
-- 表 1: data_versions（数据版本管理）
-- ============================================================
create table if not exists data_versions (
  version_id   serial primary key,
  uploaded_at  timestamptz not null default now(),
  record_count int not null default 0,
  is_active    boolean not null default false,
  notes        text
);

-- 确保同一时间只有一个 active 版本的函数
create or replace function set_active_version(v_id int)
returns void language plpgsql as $$
begin
  update data_versions set is_active = false;
  update data_versions set is_active = true where version_id = v_id;
end;
$$;

-- ============================================================
-- 表 2: occupation_mapping（职业映射缓存，保证一致性）
-- ============================================================
create table if not exists occupation_mapping (
  raw_text   text primary key,
  category   text not null,
  mapped_at  timestamptz not null default now()
);

-- ============================================================
-- 表 3: users（用户数据，核心表）
-- ============================================================
create table if not exists users (
  id                    serial primary key,
  data_version          int not null references data_versions(version_id) on delete cascade,
  -- 地域
  region_area           text not null,
  region_province       text not null,
  region_city           text not null,
  -- 基础属性
  name                  text,
  age_group             text not null,
  education             text not null,
  occupation_raw        text not null,
  occupation_category   text not null,
  family_structure      text not null,
  annual_income         text not null,
  is_upgrade            text not null,
  -- 多选字段（存为 text[]）
  consumption_views     text[] not null default '{}',
  competing_models      text[] not null default '{}',
  use_scenarios         text[] not null default '{}',
  family_trip_frequency text[] not null default '{}',
  info_channels         text[] not null default '{}',
  car_interests         text[] not null default '{}',
  hobbies               text[] not null default '{}',
  -- 订单信息
  order_status          text not null,
  intent_label          smallint not null check (intent_label in (0, 1))
  -- 0=弱意向(未锁单), 1=强意向(已锁单/订单完成)
);

-- 索引（加速常用查询）
create index if not exists idx_users_version     on users(data_version);
create index if not exists idx_users_area        on users(region_area);
create index if not exists idx_users_province    on users(region_province);
create index if not exists idx_users_city        on users(region_city);
create index if not exists idx_users_intent      on users(intent_label);

-- ============================================================
-- 表 4: predictions_cache（意向预测缓存）
-- ============================================================
create table if not exists predictions_cache (
  id               serial primary key,
  user_id          int references users(id) on delete cascade,
  data_version     int not null,
  intent_score     int not null check (intent_score between 0 and 100),
  key_factors      text[] not null default '{}',
  marketing_advice text not null default '',
  generated_at     timestamptz not null default now()
);

create index if not exists idx_pred_user    on predictions_cache(user_id);
create index if not exists idx_pred_version on predictions_cache(data_version);

-- ============================================================
-- 表 5: insights_cache（AI 洞察文字缓存）
-- ============================================================
create table if not exists insights_cache (
  id           serial primary key,
  cache_key    text not null unique,
  insight_type text not null,  -- 'compare' | 'core_profile' | 'region_predict'
  content      text not null,
  data_version int not null,
  generated_at timestamptz not null default now()
);

create index if not exists idx_insights_key     on insights_cache(cache_key);
create index if not exists idx_insights_version on insights_cache(data_version);

-- ============================================================
-- 便捷函数：获取当前活跃版本号
-- ============================================================
create or replace function get_active_version()
returns int language sql as $$
  select version_id from data_versions where is_active = true order by version_id desc limit 1;
$$;

-- ============================================================
-- 便捷视图：活跃版本的用户数据
-- ============================================================
create or replace view active_users as
  select u.*
  from users u
  where u.data_version = get_active_version();

-- ============================================================
-- RLS（Row Level Security）- 公开只读，写操作需 service role
-- ============================================================
alter table data_versions    enable row level security;
alter table occupation_mapping enable row level security;
alter table users            enable row level security;
alter table predictions_cache enable row level security;
alter table insights_cache   enable row level security;

-- 允许匿名用户只读（所有表）
create policy "anon_read_versions"    on data_versions     for select using (true);
create policy "anon_read_occ_mapping" on occupation_mapping for select using (true);
create policy "anon_read_users"       on users             for select using (true);
create policy "anon_read_predictions" on predictions_cache  for select using (true);
create policy "anon_read_insights"    on insights_cache    for select using (true);

-- 写操作只允许 service_role（API Routes 使用 service client）
-- service_role 自动绕过 RLS，无需额外配置

-- ============================================================
-- 完成提示
-- ============================================================
select 'Schema 创建完成 ✓' as status;
