-- Add public/private status page visibility to monitors
ALTER TABLE monitors 
ADD COLUMN IF NOT EXISTS status_page_public BOOLEAN DEFAULT true;

-- Add index for public status page queries
CREATE INDEX IF NOT EXISTS idx_monitors_status_page_public 
ON monitors(status_page_public, id);

-- Comment on the new column
COMMENT ON COLUMN monitors.status_page_public IS 'Whether the status page for this monitor is publicly accessible';