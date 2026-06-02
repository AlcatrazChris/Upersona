-- ============================================================
-- accounts 表：数据库管理的用户账号
-- 超级管理员始终通过 env 环境变量登录（ADMIN_USERNAME / ADMIN_PASSWORD）
-- 此表存储由管理员在 UI 中创建的额外账号
-- ============================================================

CREATE TABLE IF NOT EXISTS accounts (
  id          SERIAL       PRIMARY KEY,
  username    TEXT         UNIQUE NOT NULL,
  password_hash TEXT       NOT NULL,
  salt        TEXT         NOT NULL,
  role        TEXT         NOT NULL CHECK (role IN ('admin', 'client')),
  created_at  TIMESTAMPTZ  DEFAULT now(),
  updated_at  TIMESTAMPTZ  DEFAULT now()
);

-- RLS：仅 service_role 可读写（API Route 通过 service client 操作）
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'accounts' AND policyname = 'service role full access'
  ) THEN
    CREATE POLICY "service role full access" ON accounts
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 注意：此表没有 anon 读取策略，匿名用户无法查询
-- 所有操作都通过 API Route 的 service_role client 进行
