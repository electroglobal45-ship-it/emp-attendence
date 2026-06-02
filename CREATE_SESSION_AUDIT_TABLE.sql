-- Create session audit table to track login activity and detect token sharing
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS session_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  action TEXT NOT NULL, -- 'login', 'token_use', 'logout'
  ip_address TEXT,
  user_agent TEXT,
  device_info TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes separately
CREATE INDEX IF NOT EXISTS idx_session_audit_user ON session_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_session_audit_email ON session_audit(email, created_at DESC);

-- Enable RLS (but allow service role to bypass)
ALTER TABLE session_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own audit logs
CREATE POLICY "Users can view own session audit"
  ON session_audit
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can see all audit logs
CREATE POLICY "Admins can view all session audits"
  ON session_audit
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role = 'admin'
    )
  );

COMMENT ON TABLE session_audit IS 'Tracks login activity and API usage to detect token sharing and suspicious activity';
