-- Enhanced monitoring features migration (SAFE)
-- Only add columns that don't exist yet

-- Add new columns to monitors table (IF NOT EXISTS)
DO $$ 
BEGIN
    -- Add monitor_type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'monitor_type') THEN
        ALTER TABLE monitors ADD COLUMN monitor_type TEXT DEFAULT 'http' CHECK (monitor_type IN ('http', 'ping', 'port'));
    END IF;
    
    -- Add request_method if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'request_method') THEN
        ALTER TABLE monitors ADD COLUMN request_method TEXT DEFAULT 'GET' CHECK (request_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'));
    END IF;
    
    -- Add request_headers if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'request_headers') THEN
        ALTER TABLE monitors ADD COLUMN request_headers TEXT;
    END IF;
    
    -- Add request_body if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'request_body') THEN
        ALTER TABLE monitors ADD COLUMN request_body TEXT;
    END IF;
    
    -- Add auth_type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'auth_type') THEN
        ALTER TABLE monitors ADD COLUMN auth_type TEXT DEFAULT 'none' CHECK (auth_type IN ('none', 'basic', 'bearer', 'header'));
    END IF;
    
    -- Add auth_username if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'auth_username') THEN
        ALTER TABLE monitors ADD COLUMN auth_username TEXT;
    END IF;
    
    -- Add auth_password if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'auth_password') THEN
        ALTER TABLE monitors ADD COLUMN auth_password TEXT;
    END IF;
    
    -- Add auth_token if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'auth_token') THEN
        ALTER TABLE monitors ADD COLUMN auth_token TEXT;
    END IF;
    
    -- Add port_number if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'port_number') THEN
        ALTER TABLE monitors ADD COLUMN port_number INTEGER;
    END IF;
    
    -- Add notification_channels if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'notification_channels') THEN
        ALTER TABLE monitors ADD COLUMN notification_channels TEXT[] DEFAULT '{email}';
    END IF;
    
    -- Add slack_webhook_url if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'slack_webhook_url') THEN
        ALTER TABLE monitors ADD COLUMN slack_webhook_url TEXT;
    END IF;
    
    -- Add discord_webhook_url if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'discord_webhook_url') THEN
        ALTER TABLE monitors ADD COLUMN discord_webhook_url TEXT;
    END IF;
    
    -- Add webhook_url if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'webhook_url') THEN
        ALTER TABLE monitors ADD COLUMN webhook_url TEXT;
    END IF;
    
    -- Add alert_sms if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monitors' AND column_name = 'alert_sms') THEN
        ALTER TABLE monitors ADD COLUMN alert_sms TEXT;
    END IF;
END $$;

-- Update existing monitors to have default values for new columns
UPDATE monitors 
SET monitor_type = COALESCE(monitor_type, 'http'),
    request_method = COALESCE(request_method, 'GET'),
    auth_type = COALESCE(auth_type, 'none'),
    notification_channels = COALESCE(notification_channels, '{email}')
WHERE monitor_type IS NULL OR request_method IS NULL OR auth_type IS NULL OR notification_channels IS NULL;

-- Create indexes for performance (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_monitors_type ON monitors(monitor_type);
CREATE INDEX IF NOT EXISTS idx_monitors_notification_channels ON monitors USING GIN(notification_channels);

-- Create notification logs table to track delivery (IF NOT EXISTS)
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

-- RLS for notification logs (only if table was created)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notification_logs') THEN
        ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies if they exist
        DROP POLICY IF EXISTS "Users can read notification logs for their monitors" ON notification_logs;
        DROP POLICY IF EXISTS "Users can insert notification logs for their monitors" ON notification_logs;
        
        CREATE POLICY "Users can read notification logs for their monitors" ON notification_logs FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM monitors m 
                WHERE m.id = notification_logs.monitor_id 
                AND m.user_id = '550e8400-e29b-41d4-a716-446655440000'::uuid
            )
        );

        CREATE POLICY "Users can insert notification logs for their monitors" ON notification_logs FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM monitors m 
                WHERE m.id = notification_logs.monitor_id 
                AND m.user_id = '550e8400-e29b-41d4-a716-446655440000'::uuid
            )
        );
    END IF;
END $$;

-- Create indexes for notification logs
CREATE INDEX IF NOT EXISTS idx_notification_logs_monitor_id ON notification_logs(monitor_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status ON notification_logs(status);