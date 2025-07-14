-- Migration to add encryption support for sensitive monitor data
-- This script adds a flag to track encryption status

-- Add column to track encryption status
ALTER TABLE monitors 
ADD COLUMN IF NOT EXISTS secrets_encrypted BOOLEAN DEFAULT false;

-- Add comment to document encryption fields
COMMENT ON COLUMN monitors.auth_password IS 'Encrypted authentication password';
COMMENT ON COLUMN monitors.auth_token IS 'Encrypted authentication token';
COMMENT ON COLUMN monitors.slack_webhook_url IS 'Encrypted Slack webhook URL';
COMMENT ON COLUMN monitors.discord_webhook_url IS 'Encrypted Discord webhook URL';
COMMENT ON COLUMN monitors.webhook_url IS 'Encrypted custom webhook URL';
COMMENT ON COLUMN monitors.alert_sms IS 'Encrypted SMS alert phone number';
COMMENT ON COLUMN monitors.secrets_encrypted IS 'Flag indicating if sensitive fields are encrypted';

-- Create index for faster queries on encryption status
CREATE INDEX IF NOT EXISTS idx_monitors_encryption_status ON monitors(secrets_encrypted);

-- Note: Actual encryption migration will need to be run via API endpoint
-- to access the encryption utilities. This SQL only prepares the schema.