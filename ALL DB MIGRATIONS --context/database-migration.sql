-- Migration: Add SSL monitoring, domain expiration, and advanced features
-- Run this AFTER your existing database.sql

-- Add SSL and domain monitoring columns to monitors table
ALTER TABLE monitors 
ADD COLUMN ssl_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN ssl_expiry_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN ssl_issuer TEXT,
ADD COLUMN ssl_days_until_expiry INTEGER,
ADD COLUMN domain_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN domain_expiry_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN domain_registrar TEXT,
ADD COLUMN domain_days_until_expiry INTEGER,
ADD COLUMN monitor_type TEXT DEFAULT 'http', -- 'http', 'ping', 'port', 'keyword'
ADD COLUMN keyword_check TEXT, -- For content monitoring
ADD COLUMN expected_status_code INTEGER DEFAULT 200,
ADD COLUMN timeout_seconds INTEGER DEFAULT 15,
ADD COLUMN follow_redirects BOOLEAN DEFAULT TRUE,
ADD COLUMN user_agent TEXT DEFAULT 'SimpleUptime/1.0',
ADD COLUMN alert_sms TEXT, -- SMS number for alerts
ADD COLUMN alert_threshold INTEGER DEFAULT 2; -- How many failed checks before alert

-- SSL monitoring checks table
CREATE TABLE ssl_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  certificate_valid BOOLEAN,
  expires_at TIMESTAMP WITH TIME ZONE,
  days_until_expiry INTEGER,
  issuer TEXT,
  algorithm TEXT,
  key_size INTEGER,
  san_domains TEXT[], -- Subject Alternative Names
  warning_level TEXT, -- 'none', 'warning', 'critical'
  error_message TEXT
);

-- Domain monitoring checks table
CREATE TABLE domain_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  domain_valid BOOLEAN,
  expires_at TIMESTAMP WITH TIME ZONE,
  days_until_expiry INTEGER,
  registrar TEXT,
  name_servers TEXT[],
  warning_level TEXT, -- 'none', 'warning', 'critical'  
  error_message TEXT
);

-- Port monitoring checks table (for TCP/UDP port monitoring)
CREATE TABLE port_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  port INTEGER NOT NULL,
  protocol TEXT DEFAULT 'tcp', -- 'tcp', 'udp'
  status TEXT NOT NULL, -- 'open', 'closed', 'timeout', 'error'
  response_time INTEGER,
  error_message TEXT
);

-- Keyword/content monitoring results
CREATE TABLE keyword_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  keyword_found BOOLEAN,
  page_content_length INTEGER,
  keyword_position INTEGER, -- Position where keyword was found
  error_message TEXT
);

-- Maintenance windows (when not to send alerts)
CREATE TABLE maintenance_windows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- Team management (multi-user support)
CREATE TABLE teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  plan TEXT DEFAULT 'startup', -- 'hobby', 'startup', 'business'
  max_monitors INTEGER DEFAULT 50
);

CREATE TABLE team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner', 'admin', 'member', 'viewer'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Update monitors to belong to teams instead of individual users
ALTER TABLE monitors 
ADD COLUMN team_id UUID REFERENCES teams(id),
ADD COLUMN notification_channels TEXT[] DEFAULT '{"email"}'; -- 'email', 'sms', 'webhook', 'slack'

-- Webhook integrations table
CREATE TABLE webhooks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  method TEXT DEFAULT 'POST',
  headers JSONB DEFAULT '{}',
  template TEXT, -- Custom payload template
  events TEXT[] DEFAULT '{"down", "up"}', -- Which events trigger webhook
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Status page customization
CREATE TABLE status_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  subdomain TEXT UNIQUE, -- custom.status.yourapp.com
  custom_domain TEXT, -- status.yourbrand.com
  title TEXT DEFAULT 'System Status',
  description TEXT,
  logo_url TEXT,
  theme_color TEXT DEFAULT '#2563eb',
  monitors_to_show UUID[] DEFAULT '{}', -- Array of monitor IDs
  show_uptime_percentage BOOLEAN DEFAULT TRUE,
  show_response_times BOOLEAN DEFAULT TRUE,
  public BOOLEAN DEFAULT TRUE,
  password_protected BOOLEAN DEFAULT FALSE,
  password_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enhanced incident management
ALTER TABLE incidents 
ADD COLUMN severity TEXT DEFAULT 'major', -- 'minor', 'major', 'critical'
ADD COLUMN affected_components TEXT[],
ADD COLUMN status_update TEXT,
ADD COLUMN public_message TEXT,
ADD COLUMN investigating BOOLEAN DEFAULT TRUE,
ADD COLUMN identified BOOLEAN DEFAULT FALSE,
ADD COLUMN monitoring BOOLEAN DEFAULT FALSE;

-- Incident updates/timeline
CREATE TABLE incident_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'investigating', 'identified', 'monitoring', 'resolved'
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id)
);

-- Add RLS policies for new tables
ALTER TABLE ssl_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE port_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read SSL checks for their monitors" ON ssl_checks FOR SELECT USING (
  EXISTS (SELECT 1 FROM monitors m JOIN team_members tm ON m.team_id = tm.team_id 
          WHERE m.id = ssl_checks.monitor_id AND tm.user_id = auth.uid())
);

CREATE POLICY "Users can read domain checks for their monitors" ON domain_checks FOR SELECT USING (
  EXISTS (SELECT 1 FROM monitors m JOIN team_members tm ON m.team_id = tm.team_id 
          WHERE m.id = domain_checks.monitor_id AND tm.user_id = auth.uid())
);

CREATE POLICY "Users can read their teams" ON teams FOR SELECT USING (
  EXISTS (SELECT 1 FROM team_members WHERE team_id = teams.id AND user_id = auth.uid())
);

CREATE POLICY "Users can read their team memberships" ON team_members FOR SELECT USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_monitors_team_id ON monitors(team_id);
CREATE INDEX idx_ssl_checks_monitor_id ON ssl_checks(monitor_id);
CREATE INDEX idx_ssl_checks_expires_at ON ssl_checks(expires_at);
CREATE INDEX idx_domain_checks_monitor_id ON domain_checks(monitor_id);
CREATE INDEX idx_domain_checks_expires_at ON domain_checks(expires_at);
CREATE INDEX idx_uptime_checks_checked_at ON uptime_checks(checked_at);
CREATE INDEX idx_incidents_started_at ON incidents(started_at);

-- Demo data migration: Create demo team and assign existing monitors
DO $$
DECLARE
    demo_uuid UUID := '550e8400-e29b-41d4-a716-446655440000';
    demo_team_id UUID;
BEGIN
    -- Create demo team
    INSERT INTO teams (name, owner_id, plan, max_monitors)
    VALUES ('Demo Team', demo_uuid, 'business', 999)
    RETURNING id INTO demo_team_id;
    
    -- Add demo user to team
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (demo_team_id, demo_uuid, 'owner');
    
    -- Assign existing monitors to demo team
    UPDATE monitors 
    SET team_id = demo_team_id 
    WHERE user_id = demo_uuid;
END $$;