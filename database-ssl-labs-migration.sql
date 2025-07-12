-- Migration: Add SSL Labs specific fields
-- Run this after the main database-migration.sql

-- Add SSL Labs specific columns to ssl_checks table
ALTER TABLE ssl_checks 
ADD COLUMN IF NOT EXISTS grade TEXT,
ADD COLUMN IF NOT EXISTS has_warnings BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS vulnerabilities TEXT[] DEFAULT '{}';

-- Add SSL Labs specific columns to monitors table  
ALTER TABLE monitors
ADD COLUMN IF NOT EXISTS ssl_grade TEXT,
ADD COLUMN IF NOT EXISTS ssl_has_warnings BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ssl_vulnerabilities TEXT[] DEFAULT '{}';

-- Update the indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ssl_checks_grade ON ssl_checks(grade);
CREATE INDEX IF NOT EXISTS idx_ssl_checks_warning_level ON ssl_checks(warning_level);
CREATE INDEX IF NOT EXISTS idx_monitors_ssl_grade ON monitors(ssl_grade);

-- Example of what the data will look like:
-- INSERT INTO ssl_checks (monitor_id, certificate_valid, expires_at, days_until_expiry, issuer, grade, has_warnings, vulnerabilities)
-- VALUES ('uuid', true, '2024-12-15', 365, 'Let\'s Encrypt', 'A+', false, '{}');