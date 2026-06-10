-- ============================================================
-- upersona-v2  通用数据集存储  Migration 001
-- 在已有 Upersona 库（含 upersona_users 等表）的同一 Supabase
-- 项目中新增三张表，与原有表不冲突。
-- ============================================================

-- ── 数据集元信息 + 字段 schema ─────────────────────────────────
CREATE TABLE IF NOT EXISTS upersona_datasets (
  id           TEXT         PRIMARY KEY,
  name         TEXT         NOT NULL,
  source_type  TEXT         NOT NULL DEFAULT 'xlsx',  -- 'xlsx'|'xls'|'csv'|'json'
  row_count    INT          NOT NULL DEFAULT 0,
  fields       JSONB        NOT NULL DEFAULT '[]',    -- Field[] serialized
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  uploaded_by  TEXT,                                  -- username of uploader
  is_active    BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ── 数据记录（分块存储，每块最多 1000 行）────────────────────────
-- 分块原因：单个 JSONB 列超大时 Supabase 查询性能下降；
-- chunk_index 从 0 开始，按序拼接可还原完整记录集。
CREATE TABLE IF NOT EXISTS upersona_dataset_chunks (
  id           BIGSERIAL    PRIMARY KEY,
  dataset_id   TEXT         NOT NULL REFERENCES upersona_datasets(id) ON DELETE CASCADE,
  chunk_index  INT          NOT NULL,
  rows         JSONB        NOT NULL DEFAULT '[]',
  UNIQUE (dataset_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_upersona_chunks_dataset
  ON upersona_dataset_chunks(dataset_id, chunk_index);

-- ── 每数据集的 UI 配置（视图配置、画像配置、保存图表）──────────────
CREATE TABLE IF NOT EXISTS upersona_dataset_configs (
  dataset_id      TEXT         PRIMARY KEY REFERENCES upersona_datasets(id) ON DELETE CASCADE,
  view_config     JSONB        NOT NULL DEFAULT '{}',
  persona_configs JSONB        NOT NULL DEFAULT '[]',
  saved_charts    JSONB        NOT NULL DEFAULT '[]',
  canvas_elements JSONB        NOT NULL DEFAULT '[]',
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── RLS ────────────────────────────────────────────────────────
-- 所有写操作通过 service_role key（在 Next.js API Route 中），
-- 读操作允许任意已验证会话（通过 Next.js JWT 中间件鉴权后由
-- service_role 查询，因此无需单独暴露 RLS SELECT 策略）。
-- 这里开启 RLS 但不添加 anon 策略，防止直接暴露 client key 访问。
ALTER TABLE upersona_datasets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE upersona_dataset_chunks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE upersona_dataset_configs ENABLE ROW LEVEL SECURITY;

-- service_role 绕过 RLS，无需额外策略。
-- 如后续需要 Supabase client key 直接读取，可在此添加 SELECT 策略。
