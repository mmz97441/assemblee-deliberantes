-- Simple rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_key TEXT NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_rate_limits_lookup ON rate_limits (action_key, user_id, created_at DESC);

-- Auto-cleanup: delete entries older than 1 hour
CREATE OR REPLACE FUNCTION cleanup_rate_limits() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '1 hour';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_rate_limits
  AFTER INSERT ON rate_limits
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_rate_limits();

-- RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limits_own" ON rate_limits
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
