-- User profiles
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  subscription_status TEXT DEFAULT 'trial',
  trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- Website monitors
CREATE TABLE monitors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'unknown', -- 'up', 'down', 'unknown'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  alert_email TEXT,
  check_interval INTEGER DEFAULT 5, -- minutes
  last_checked TIMESTAMP WITH TIME ZONE,
  last_status_code INTEGER,
  last_response_time INTEGER -- milliseconds
);

-- Uptime checks history
CREATE TABLE uptime_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  location TEXT NOT NULL, -- 'us-east', 'us-west', 'europe'
  status TEXT NOT NULL, -- 'up', 'down', 'timeout', 'error'
  response_time INTEGER, -- milliseconds
  status_code INTEGER,
  error_message TEXT,
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Incidents (when sites go down)
CREATE TABLE incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  cause TEXT,
  resolved BOOLEAN DEFAULT FALSE
);

-- Alert log
CREATE TABLE alerts_sent (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  incident_id UUID REFERENCES incidents(id),
  alert_type TEXT NOT NULL, -- 'down', 'up'
  recipient TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivery_status TEXT DEFAULT 'sent'
);

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE uptime_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts_sent ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can read own monitors" ON monitors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own monitors" ON monitors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monitors" ON monitors FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own monitors" ON monitors FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can read own uptime checks" ON uptime_checks FOR SELECT USING (
  EXISTS (SELECT 1 FROM monitors WHERE monitors.id = uptime_checks.monitor_id AND monitors.user_id = auth.uid())
);
CREATE POLICY "Users can read own incidents" ON incidents FOR SELECT USING (
  EXISTS (SELECT 1 FROM monitors WHERE monitors.id = incidents.monitor_id AND monitors.user_id = auth.uid())
);
CREATE POLICY "Users can read own alerts" ON alerts_sent FOR SELECT USING (
  EXISTS (SELECT 1 FROM monitors WHERE monitors.id = alerts_sent.monitor_id AND monitors.user_id = auth.uid())
);

-- Create demo user for testing
-- Generate a proper UUID for demo user
DO $$
DECLARE
    demo_uuid UUID := '550e8400-e29b-41d4-a716-446655440000';
BEGIN
    -- Insert into auth.users if it doesn't exist
    INSERT INTO auth.users (id, email, created_at, updated_at, email_confirmed_at, aud, role)
    VALUES (demo_uuid, 'demo@example.com', NOW(), NOW(), NOW(), 'authenticated', 'authenticated')
    ON CONFLICT (id) DO NOTHING;

    -- Insert into profiles if it doesn't exist
    INSERT INTO profiles (id, email)
    VALUES (demo_uuid, 'demo@example.com')
    ON CONFLICT (id) DO NOTHING;

    -- Insert sample monitors for demo
    INSERT INTO monitors (user_id, url, name, status, alert_email)
    VALUES 
      (demo_uuid, 'https://google.com', 'Google', 'unknown', 'demo@example.com'),
      (demo_uuid, 'https://github.com', 'GitHub', 'unknown', 'demo@example.com'),
      (demo_uuid, 'https://stackoverflow.com', 'Stack Overflow', 'unknown', 'demo@example.com')
    ON CONFLICT DO NOTHING;
END $$;