-- PRODUCTION DATABASE MIGRATION
-- This consolidates all migrations needed for production deployment
-- Run this on a fresh Supabase instance

-- ============================================================================
-- CORE TABLES (Base Structure)
-- ============================================================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'canceled', 'past_due')),
  trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days'),
  -- Subscription management
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_id TEXT DEFAULT 'starter' CHECK (plan_id IN ('starter', 'pro', 'enterprise')),
  billing_cycle_anchor TIMESTAMP WITH TIME ZONE
);

-- Website monitors
CREATE TABLE monitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'unknown' CHECK (status IN ('up', 'down', 'unknown')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  alert_email TEXT,
  check_interval INTEGER DEFAULT 5, -- minutes
  last_checked TIMESTAMP WITH TIME ZONE,
  last_status_code INTEGER,
  last_response_time INTEGER, -- milliseconds
  
  -- Enhanced monitoring features
  monitor_type TEXT DEFAULT 'http' CHECK (monitor_type IN ('http', 'ping', 'port', 'heartbeat')),
  ssl_enabled BOOLEAN DEFAULT TRUE,
  domain_enabled BOOLEAN DEFAULT TRUE,
  timeout_seconds INTEGER DEFAULT 15,
  follow_redirects BOOLEAN DEFAULT TRUE,
  expected_status_code INTEGER DEFAULT 200,
  user_agent TEXT DEFAULT 'SimpleUptime/1.0',
  
  -- Additional notification channels
  slack_webhook_url TEXT,
  discord_webhook_url TEXT,
  alert_sms TEXT,
  webhook_url TEXT,
  
  -- HTTP monitoring specifics
  request_method TEXT DEFAULT 'GET',
  request_headers JSONB,
  request_body TEXT,
  auth_type TEXT DEFAULT 'none' CHECK (auth_type IN ('none', 'basic', 'bearer', 'api_key')),
  auth_username TEXT,
  auth_password TEXT,
  auth_token TEXT,
  
  -- Port monitoring
  port_number INTEGER,
  
  -- Heartbeat monitoring
  heartbeat_interval INTEGER DEFAULT 60, -- seconds
  last_heartbeat TIMESTAMP WITH TIME ZONE,
  
  -- SSL/Domain info (cached from checks)
  ssl_expiry_date TIMESTAMP WITH TIME ZONE,
  ssl_issuer TEXT,
  ssl_days_until_expiry INTEGER,
  ssl_grade TEXT,
  ssl_has_warnings BOOLEAN DEFAULT FALSE,
  ssl_vulnerabilities TEXT[],
  domain_expiry_date TIMESTAMP WITH TIME ZONE,
  domain_registrar TEXT,
  domain_days_until_expiry INTEGER
);

-- ============================================================================
-- MONITORING DATA TABLES
-- ============================================================================

-- Uptime checks history
CREATE TABLE uptime_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  location TEXT NOT NULL, -- 'us-east', 'us-west', 'europe', 'asia-pacific', 'south-america'
  status TEXT NOT NULL CHECK (status IN ('up', 'down', 'timeout', 'error')),
  response_time INTEGER, -- milliseconds
  status_code INTEGER,
  error_message TEXT,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SSL monitoring checks
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
  san_domains TEXT[],
  warning_level TEXT CHECK (warning_level IN ('none', 'warning', 'critical')),
  error_message TEXT,
  grade TEXT, -- SSL Labs grade
  has_warnings BOOLEAN DEFAULT FALSE,
  vulnerabilities TEXT[]
);

-- Domain expiration checks
CREATE TABLE domain_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  domain_valid BOOLEAN,
  expires_at TIMESTAMP WITH TIME ZONE,
  days_until_expiry INTEGER,
  registrar TEXT,
  name_servers TEXT[],
  warning_level TEXT CHECK (warning_level IN ('none', 'warning', 'critical')),
  error_message TEXT
);

-- ============================================================================
-- INCIDENT MANAGEMENT
-- ============================================================================

-- Incidents (when sites go down)
CREATE TABLE incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  cause TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  incident_type TEXT DEFAULT 'downtime' CHECK (incident_type IN ('downtime', 'missed_heartbeat', 'ssl_issue', 'domain_issue'))
);

-- Enhanced network diagnostics for incidents
CREATE TABLE incident_diagnostics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  location TEXT NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- DNS Resolution
  dns_success BOOLEAN,
  dns_resolved_ips TEXT[],
  dns_resolution_time_ms INTEGER,
  dns_nameservers TEXT[],
  dns_errors TEXT[],
  dns_cname_chain TEXT[],
  dns_mx_records TEXT[],
  dns_txt_records TEXT[],
  
  -- Traceroute
  traceroute_success BOOLEAN,
  traceroute_total_hops INTEGER,
  traceroute_total_time_ms INTEGER,
  traceroute_packet_loss NUMERIC,
  traceroute_hops JSONB,
  
  -- HTTP Details
  http_connection_time_ms INTEGER,
  http_ssl_handshake_time_ms INTEGER,
  http_first_byte_time_ms INTEGER,
  http_total_time_ms INTEGER,
  http_response_headers JSONB,
  http_status_code INTEGER,
  http_status_text TEXT,
  http_response_size_bytes INTEGER,
  http_redirect_chain TEXT[],
  http_content_type TEXT,
  http_server_info TEXT,
  http_error_details TEXT,
  
  -- SSL/TLS Details
  ssl_certificate_valid BOOLEAN,
  ssl_certificate_chain_length INTEGER,
  ssl_cipher_suite TEXT,
  ssl_tls_version TEXT,
  ssl_certificate_issuer TEXT,
  ssl_certificate_expiry TIMESTAMP WITH TIME ZONE,
  ssl_san_domains TEXT[],
  ssl_errors TEXT[],
  ssl_ocsp_status TEXT,
  
  -- Geographic Analysis
  geo_server_country TEXT,
  geo_server_city TEXT,
  geo_server_latitude NUMERIC,
  geo_server_longitude NUMERIC,
  geo_is_cdn BOOLEAN,
  geo_cdn_provider TEXT,
  geo_edge_location TEXT,
  geo_asn TEXT,
  geo_isp TEXT,
  geo_organization TEXT,
  
  -- Metadata
  diagnostic_version TEXT DEFAULT '1.0'
);

-- ============================================================================
-- NOTIFICATIONS AND ALERTS
-- ============================================================================

-- Alert log
CREATE TABLE alerts_sent (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES incidents(id),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('down', 'up', 'ssl_expiring', 'ssl_warning', 'domain_expiring')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'slack', 'discord', 'sms', 'webhook')),
  recipient TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'failed', 'pending'))
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Core indexes
CREATE INDEX idx_monitors_user_id ON monitors(user_id);
CREATE INDEX idx_monitors_status ON monitors(status);
CREATE INDEX idx_monitors_monitor_type ON monitors(monitor_type);
CREATE INDEX idx_uptime_checks_monitor_id ON uptime_checks(monitor_id);
CREATE INDEX idx_uptime_checks_checked_at ON uptime_checks(checked_at);
CREATE INDEX idx_uptime_checks_location ON uptime_checks(location);
CREATE INDEX idx_incidents_monitor_id ON incidents(monitor_id);
CREATE INDEX idx_incidents_resolved ON incidents(resolved);
CREATE INDEX idx_ssl_checks_monitor_id ON ssl_checks(monitor_id);
CREATE INDEX idx_domain_checks_monitor_id ON domain_checks(monitor_id);
CREATE INDEX idx_alerts_sent_monitor_id ON alerts_sent(monitor_id);

-- Composite indexes for common queries
CREATE INDEX idx_uptime_checks_monitor_date ON uptime_checks(monitor_id, checked_at DESC);
CREATE INDEX idx_incidents_monitor_resolved ON incidents(monitor_id, resolved);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE uptime_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ssl_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts_sent ENABLE ROW LEVEL SECURITY;

-- Profile policies
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Monitor policies
CREATE POLICY "Users can read own monitors" ON monitors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own monitors" ON monitors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monitors" ON monitors FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own monitors" ON monitors FOR DELETE USING (auth.uid() = user_id);

-- Uptime check policies
CREATE POLICY "Users can read own uptime checks" ON uptime_checks FOR SELECT USING (
  EXISTS (SELECT 1 FROM monitors WHERE monitors.id = uptime_checks.monitor_id AND monitors.user_id = auth.uid())
);

-- SSL check policies
CREATE POLICY "Users can read own ssl checks" ON ssl_checks FOR SELECT USING (
  EXISTS (SELECT 1 FROM monitors WHERE monitors.id = ssl_checks.monitor_id AND monitors.user_id = auth.uid())
);

-- Domain check policies
CREATE POLICY "Users can read own domain checks" ON domain_checks FOR SELECT USING (
  EXISTS (SELECT 1 FROM monitors WHERE monitors.id = domain_checks.monitor_id AND monitors.user_id = auth.uid())
);

-- Incident policies
CREATE POLICY "Users can read own incidents" ON incidents FOR SELECT USING (
  EXISTS (SELECT 1 FROM monitors WHERE monitors.id = incidents.monitor_id AND monitors.user_id = auth.uid())
);

-- Incident diagnostics policies
CREATE POLICY "Users can read own incident diagnostics" ON incident_diagnostics FOR SELECT USING (
  EXISTS (SELECT 1 FROM monitors WHERE monitors.id = incident_diagnostics.monitor_id AND monitors.user_id = auth.uid())
);

-- Alert policies
CREATE POLICY "Users can read own alerts" ON alerts_sent FOR SELECT USING (
  EXISTS (SELECT 1 FROM monitors WHERE monitors.id = alerts_sent.monitor_id AND monitors.user_id = auth.uid())
);

-- ============================================================================
-- DEMO DATA (Optional - for development/testing)
-- ============================================================================

-- Create demo user (only if it doesn't exist)
DO $$
DECLARE
    demo_uuid UUID := '550e8400-e29b-41d4-a716-446655440000';
BEGIN
    -- Insert into auth.users if it doesn't exist
    INSERT INTO auth.users (id, email, created_at, updated_at, email_confirmed_at, aud, role)
    VALUES (demo_uuid, 'demo@example.com', NOW(), NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;

    -- Insert into profiles if it doesn't exist
    INSERT INTO profiles (id, email, subscription_status, trial_ends_at)
    VALUES (demo_uuid, 'demo@example.com', 'trial', NOW() + INTERVAL '30 days')
    ON CONFLICT (id) DO NOTHING;

    -- Insert sample monitors for demo
    INSERT INTO monitors (user_id, url, name, status, alert_email, monitor_type)
    VALUES 
      (demo_uuid, 'https://google.com', 'Google', 'up', 'demo@example.com', 'http'),
      (demo_uuid, 'https://github.com', 'GitHub', 'up', 'demo@example.com', 'http'),
      (demo_uuid, 'https://stackoverflow.com', 'Stack Overflow', 'up', 'demo@example.com', 'http'),
      (demo_uuid, 'heartbeat://demo-app', 'Demo App Heartbeat', 'up', 'demo@example.com', 'heartbeat')
    ON CONFLICT DO NOTHING;
END $$;

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, created_at)
  VALUES (new.id, new.email, new.created_at);
  RETURN new;
END;
$$ language plpgsql security definer;

-- Trigger to automatically create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '🚀 Production database migration completed successfully!';
    RAISE NOTICE '✅ All tables, indexes, and RLS policies created';
    RAISE NOTICE '✅ Demo data inserted for testing';
    RAISE NOTICE '✅ Triggers configured for user management';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Update your .env with database connection string';
    RAISE NOTICE '2. Deploy your application';
    RAISE NOTICE '3. Set up cron jobs for monitoring';
    RAISE NOTICE '4. Configure Stripe for payments';
END $$;