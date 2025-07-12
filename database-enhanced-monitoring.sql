-- Enhanced monitoring features migration
-- Add support for custom headers, auth, multiple monitor types, and notification channels

-- Add new columns to monitors table
ALTER TABLE monitors 
ADD COLUMN monitor_type TEXT DEFAULT 'http' CHECK (monitor_type IN ('http', 'ping', 'port')),
ADD COLUMN request_method TEXT DEFAULT 'GET' CHECK (request_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD')),
ADD COLUMN request_headers TEXT, -- JSON string of custom headers
ADD COLUMN request_body TEXT,
ADD COLUMN auth_type TEXT DEFAULT 'none' CHECK (auth_type IN ('none', 'basic', 'bearer', 'header')),
ADD COLUMN auth_username TEXT,
ADD COLUMN auth_password TEXT, -- Encrypted in production
ADD COLUMN auth_token TEXT, -- Bearer tokens, API keys, etc.
ADD COLUMN port_number INTEGER,
ADD COLUMN notification_channels TEXT[] DEFAULT '{email}', -- Array of notification types
ADD COLUMN slack_webhook_url TEXT,
ADD COLUMN discord_webhook_url TEXT,
ADD COLUMN webhook_url TEXT,
ADD COLUMN alert_sms TEXT; -- Phone number for SMS alerts

-- Update existing monitors to have default values
UPDATE monitors 
SET monitor_type = 'http', 
    request_method = 'GET',
    auth_type = 'none',
    notification_channels = '{email}'
WHERE monitor_type IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_monitors_type ON monitors(monitor_type);
CREATE INDEX IF NOT EXISTS idx_monitors_notification_channels ON monitors USING GIN(notification_channels);

-- Create notification logs table to track delivery
CREATE TABLE IF NOT EXISTS notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
    notification_type TEXT NOT NULL CHECK (notification_type IN ('email', 'slack', 'sms', 'discord', 'webhook')),
    recipient TEXT NOT NULL, -- email, phone, webhook URL, etc.
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for notification logs
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read notification logs for their monitors" ON notification_logs FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM monitors m 
        JOIN team_members tm ON m.team_id = tm.team_id 
        WHERE m.id = notification_logs.monitor_id AND tm.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert notification logs for their monitors" ON notification_logs FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM monitors m 
        JOIN team_members tm ON m.team_id = tm.team_id 
        WHERE m.id = notification_logs.monitor_id AND tm.user_id = auth.uid()
    )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notification_logs_monitor_id ON notification_logs(monitor_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);

-- Comments for documentation
COMMENT ON COLUMN monitors.request_headers IS 'JSON string containing custom HTTP headers';
COMMENT ON COLUMN monitors.auth_type IS 'Authentication type: none, basic, bearer, or header';
COMMENT ON COLUMN monitors.notification_channels IS 'Array of notification channels to use for alerts';
COMMENT ON TABLE notification_logs IS 'Log of all notifications sent for monitoring alerts';