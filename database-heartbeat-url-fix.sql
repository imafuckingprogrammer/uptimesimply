-- Fix URL constraint to support heartbeat:// URLs
-- This allows heartbeat monitoring to work properly

-- Drop the existing constraint
ALTER TABLE monitors DROP CONSTRAINT IF EXISTS check_url_format;

-- Add new constraint that supports http://, https://, and heartbeat:// URLs
ALTER TABLE monitors ADD CONSTRAINT check_url_format 
  CHECK (url ~ '^(https?|heartbeat)://');

-- Update any existing heartbeat monitors that might have invalid URLs
-- This is safe because heartbeat URLs don't need to be real URLs
UPDATE monitors 
SET url = 'heartbeat://monitor-' || id::text
WHERE monitor_type = 'heartbeat' 
  AND url NOT LIKE 'heartbeat://%';