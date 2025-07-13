-- Enhanced incident diagnostics table
-- Run this migration to add detailed network diagnostics storage

-- Create table for storing detailed incident diagnostics
CREATE TABLE IF NOT EXISTS incident_diagnostics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID REFERENCES incidents(id) ON DELETE CASCADE,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  location TEXT NOT NULL, -- 'us-east', 'us-west', 'europe'
  
  -- DNS Resolution Data
  dns_success BOOLEAN DEFAULT FALSE,
  dns_resolved_ips TEXT[], -- Array of resolved IP addresses
  dns_resolution_time_ms INTEGER,
  dns_nameservers TEXT[],
  dns_errors TEXT[],
  dns_cname_chain TEXT[],
  dns_mx_records TEXT[],
  dns_txt_records TEXT[],
  
  -- Traceroute Data
  traceroute_success BOOLEAN DEFAULT FALSE,
  traceroute_total_hops INTEGER,
  traceroute_total_time_ms INTEGER,
  traceroute_packet_loss DECIMAL(5,2),
  traceroute_hops JSONB, -- Array of hop details
  
  -- HTTP Diagnostics
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
  
  -- SSL/TLS Diagnostics
  ssl_certificate_valid BOOLEAN DEFAULT FALSE,
  ssl_certificate_chain_length INTEGER,
  ssl_cipher_suite TEXT,
  ssl_tls_version TEXT,
  ssl_certificate_issuer TEXT,
  ssl_certificate_expiry TEXT,
  ssl_san_domains TEXT[],
  ssl_errors TEXT[],
  ssl_ocsp_status TEXT,
  
  -- Geographic Analysis
  geo_server_country TEXT,
  geo_server_city TEXT,
  geo_server_latitude DECIMAL(10,8),
  geo_server_longitude DECIMAL(11,8),
  geo_is_cdn BOOLEAN DEFAULT FALSE,
  geo_cdn_provider TEXT,
  geo_edge_location TEXT,
  geo_asn TEXT,
  geo_isp TEXT,
  geo_organization TEXT,
  
  -- Metadata
  captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  diagnostic_version TEXT DEFAULT '1.0'
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_incident_diagnostics_incident_id ON incident_diagnostics(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_diagnostics_monitor_id ON incident_diagnostics(monitor_id);
CREATE INDEX IF NOT EXISTS idx_incident_diagnostics_captured_at ON incident_diagnostics(captured_at);
CREATE INDEX IF NOT EXISTS idx_incident_diagnostics_location ON incident_diagnostics(location);

-- Add RLS policy for multi-tenant security
ALTER TABLE incident_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own incident diagnostics" ON incident_diagnostics FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM monitors 
    WHERE monitors.id = incident_diagnostics.monitor_id 
    AND monitors.user_id = auth.uid()
  )
);

-- Service role can insert diagnostics (for cron jobs)
CREATE POLICY "Service role can insert diagnostics" ON incident_diagnostics FOR INSERT 
WITH CHECK (true);

-- Add foreign key constraint with cascade delete
ALTER TABLE incident_diagnostics 
ADD CONSTRAINT fk_incident_diagnostics_incident 
FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE;

ALTER TABLE incident_diagnostics 
ADD CONSTRAINT fk_incident_diagnostics_monitor 
FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE;

-- Add check constraints for data validation
ALTER TABLE incident_diagnostics ADD CONSTRAINT chk_location 
CHECK (location IN ('us-east', 'us-west', 'europe', 'asia-pacific'));

ALTER TABLE incident_diagnostics ADD CONSTRAINT chk_positive_times 
CHECK (
  dns_resolution_time_ms >= 0 AND
  traceroute_total_time_ms >= 0 AND
  http_connection_time_ms >= 0 AND
  http_total_time_ms >= 0
);

ALTER TABLE incident_diagnostics ADD CONSTRAINT chk_packet_loss_range 
CHECK (traceroute_packet_loss >= 0 AND traceroute_packet_loss <= 100);

-- Add comment explaining the table purpose
COMMENT ON TABLE incident_diagnostics IS 
'Stores detailed network diagnostics captured during website incidents for enhanced troubleshooting';

COMMENT ON COLUMN incident_diagnostics.traceroute_hops IS 
'JSON array containing detailed hop-by-hop traceroute information including IPs, hostnames, and timing';

COMMENT ON COLUMN incident_diagnostics.http_response_headers IS 
'JSON object containing HTTP response headers for debugging connectivity issues';

-- Example query to get diagnostics for an incident:
-- SELECT 
--   id.*,
--   i.started_at,
--   i.cause,
--   m.name as monitor_name,
--   m.url
-- FROM incident_diagnostics id
-- JOIN incidents i ON id.incident_id = i.id  
-- JOIN monitors m ON id.monitor_id = m.id
-- WHERE i.id = 'your-incident-id'
-- ORDER BY id.captured_at DESC;