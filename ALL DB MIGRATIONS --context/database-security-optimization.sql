-- Security and Performance Optimization Migration
-- Run this after backing up your database

-- 1. Add indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON monitors(user_id);
CREATE INDEX IF NOT EXISTS idx_monitors_url ON monitors(url);
CREATE INDEX IF NOT EXISTS idx_monitors_status ON monitors(status);
CREATE INDEX IF NOT EXISTS idx_monitors_last_checked ON monitors(last_checked);

CREATE INDEX IF NOT EXISTS idx_uptime_checks_monitor_id ON uptime_checks(monitor_id);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_checked_at ON uptime_checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_uptime_checks_monitor_checked ON uptime_checks(monitor_id, checked_at);

CREATE INDEX IF NOT EXISTS idx_incidents_monitor_id ON incidents(monitor_id);
CREATE INDEX IF NOT EXISTS idx_incidents_started_at ON incidents(started_at);
CREATE INDEX IF NOT EXISTS idx_incidents_resolved ON incidents(resolved);
CREATE INDEX IF NOT EXISTS idx_incidents_monitor_resolved ON incidents(monitor_id, resolved);

CREATE INDEX IF NOT EXISTS idx_incident_diagnostics_incident_id ON incident_diagnostics(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_diagnostics_monitor_id ON incident_diagnostics(monitor_id);

-- 2. Add columns for encrypted credentials (if not exists)
ALTER TABLE monitors 
  ADD COLUMN IF NOT EXISTS auth_username_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS auth_password_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS auth_token_encrypted TEXT;

-- 3. Add monitoring table for storing check results in a more efficient way
CREATE TABLE IF NOT EXISTS monitoring_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('up', 'down', 'timeout', 'error')),
  response_time INTEGER,
  status_code INTEGER,
  error_message TEXT,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for the new monitoring_checks table
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_monitor_id ON monitoring_checks(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_checked_at ON monitoring_checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_monitor_checked ON monitoring_checks(monitor_id, checked_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_status ON monitoring_checks(status);

-- 4. Create table for rate limiting (optional - can use Redis in production)
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  request_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_hash ON rate_limits(key_hash);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);

-- 5. Create audit log table for security monitoring
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- 6. Add unique constraint to prevent URL duplication per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitors_user_url_unique 
  ON monitors(user_id, url);

-- 7. Optimize uptime_checks table by adding partitioning-friendly index
-- Removed function-based index due to IMMUTABLE requirement
-- Using standard timestamp index instead
CREATE INDEX IF NOT EXISTS idx_uptime_checks_date_monitor 
  ON uptime_checks(checked_at, monitor_id);

-- 8. Clean up old data (optional - adjust retention as needed)
-- Delete uptime checks older than 90 days
DELETE FROM uptime_checks 
WHERE checked_at < NOW() - INTERVAL '90 days';

-- Delete monitoring checks older than 90 days
DELETE FROM monitoring_checks 
WHERE checked_at < NOW() - INTERVAL '90 days';

-- Delete resolved incidents older than 1 year
DELETE FROM incidents 
WHERE resolved = true 
  AND ended_at < NOW() - INTERVAL '1 year';

-- 9. Update RLS policies for new tables
-- Enable RLS on new tables
ALTER TABLE monitoring_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy for monitoring_checks
CREATE POLICY "Users can view their own monitoring checks" ON monitoring_checks
  FOR SELECT USING (
    monitor_id IN (
      SELECT id FROM monitors WHERE user_id = auth.uid()
    )
  );

-- RLS policy for audit_logs
CREATE POLICY "Users can view their own audit logs" ON audit_logs
  FOR SELECT USING (user_id = auth.uid());

-- 10. Add trigger for automatic audit logging
CREATE OR REPLACE FUNCTION log_monitor_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (NEW.user_id, 'CREATE', 'monitor', NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (NEW.user_id, 'UPDATE', 'monitor', NEW.id, 
            jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW)));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details)
    VALUES (OLD.user_id, 'DELETE', 'monitor', OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for monitor changes
DROP TRIGGER IF EXISTS monitor_audit_trigger ON monitors;
CREATE TRIGGER monitor_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON monitors
  FOR EACH ROW EXECUTE FUNCTION log_monitor_changes();

-- 11. Add constraints for data integrity
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_url_format') THEN
    ALTER TABLE monitors ADD CONSTRAINT check_url_format CHECK (url ~ '^https?://');
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_name_length') THEN
    ALTER TABLE monitors ADD CONSTRAINT check_name_length CHECK (char_length(name) BETWEEN 1 AND 100);
  END IF;
END $$;

-- 12. Vacuum and analyze for optimal performance
-- Note: Run these commands separately outside of a transaction block:
-- VACUUM ANALYZE monitors;
-- VACUUM ANALYZE uptime_checks;
-- VACUUM ANALYZE incidents;
-- VACUUM ANALYZE incident_diagnostics;