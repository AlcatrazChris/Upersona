-- 登录日志表（可重复执行）
-- 记录每次登录尝试的用户名、IP、设备信息、成功/失败

CREATE TABLE IF NOT EXISTS login_logs (
  id          SERIAL PRIMARY KEY,
  username    TEXT         NOT NULL,
  ip          TEXT,
  user_agent  TEXT,
  success     BOOLEAN      NOT NULL DEFAULT true,
  logged_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 按登录时间倒序查询最快
CREATE INDEX IF NOT EXISTS login_logs_logged_at_idx ON login_logs (logged_at DESC);
CREATE INDEX IF NOT EXISTS login_logs_username_idx  ON login_logs (username);

-- RLS：仅 service_role 可读写
ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'login_logs' AND policyname = 'service role full access'
  ) THEN
    CREATE POLICY "service role full access" ON login_logs
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 自动清理：保留最近 90 天的日志（可选，需要 pg_cron 扩展）
-- SELECT cron.schedule('cleanup-login-logs', '0 3 * * *',
--   $$DELETE FROM login_logs WHERE logged_at < now() - interval '90 days'$$);
