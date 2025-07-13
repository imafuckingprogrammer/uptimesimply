-- Add heartbeat-specific columns to monitors table
ALTER TABLE monitors 
ADD COLUMN IF NOT EXISTS monitor_type VARCHAR(20) DEFAULT 'http' CHECK (monitor_type IN ('http', 'ping', 'port', 'heartbeat')),
ADD COLUMN IF NOT EXISTS heartbeat_interval INTEGER DEFAULT 60,
ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS description TEXT;

-- Create heartbeats table for storing heartbeat ping records
CREATE TABLE IF NOT EXISTS heartbeats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  status VARCHAR(10) NOT NULL CHECK (status IN ('up', 'down')),
  message TEXT,
  response_time INTEGER,
  metadata JSONB DEFAULT '{}',
  source_ip VARCHAR(45),
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add index for efficient heartbeat queries
CREATE INDEX IF NOT EXISTS idx_heartbeats_monitor_received ON heartbeats(monitor_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_heartbeats_received_at ON heartbeats(received_at DESC);

-- Add incident_type column to incidents table for tracking heartbeat incidents
ALTER TABLE incidents 
ADD COLUMN IF NOT EXISTS incident_type VARCHAR(20) DEFAULT 'monitoring_check' CHECK (incident_type IN ('monitoring_check', 'missed_heartbeat')),
ADD COLUMN IF NOT EXISTS resolution_method VARCHAR(20) CHECK (resolution_method IN ('monitoring_check', 'heartbeat', 'manual'));

-- Add indexes for monitor types and heartbeat intervals
CREATE INDEX IF NOT EXISTS idx_monitors_type ON monitors(monitor_type);
CREATE INDEX IF NOT EXISTS idx_monitors_heartbeat_type ON monitors(monitor_type, last_heartbeat) WHERE monitor_type = 'heartbeat';

-- Add comment to explain heartbeat monitoring
COMMENT ON TABLE heartbeats IS 'Stores heartbeat pings from monitored services for passive monitoring';
COMMENT ON COLUMN monitors.monitor_type IS 'Type of monitoring: http (active), ping (active), port (active), heartbeat (passive)';
COMMENT ON COLUMN monitors.heartbeat_interval IS 'Expected interval between heartbeats in seconds (for heartbeat monitors)';
COMMENT ON COLUMN monitors.last_heartbeat IS 'Timestamp of last received heartbeat (for heartbeat monitors)';

-- Sample heartbeat monitor data for testing
INSERT INTO monitors (
  id,
  user_id, 
  name, 
  url, 
  monitor_type, 
  heartbeat_interval,
  description,
  alert_email, 
  status, 
  ssl_enabled, 
  domain_enabled
) VALUES (
  gen_random_uuid(),
  '550e8400-e29b-41d4-a716-446655440000',
  'Sample Cron Job',
  'heartbeat://sample-cron-job',
  'heartbeat',
  300,
  'Example heartbeat monitor for a cron job that should ping every 5 minutes',
  'demo@example.com',
  'unknown',
  false,
  false
) ON CONFLICT DO NOTHING;