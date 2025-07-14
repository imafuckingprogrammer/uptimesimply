-- SLA notifications table to track breach notifications and prevent spam
CREATE TABLE IF NOT EXISTS sla_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  breach_count INTEGER NOT NULL DEFAULT 0,
  worst_uptime DECIMAL(5,3) NOT NULL, -- e.g., 99.123
  breach_details JSONB, -- Detailed breach information
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_sla_notifications_monitor_sent 
ON sla_notifications(monitor_id, sent_at DESC);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_sla_notifications_sent_at 
ON sla_notifications(sent_at);

-- Enable RLS
ALTER TABLE sla_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own SLA notifications" 
ON sla_notifications FOR SELECT 
USING (monitor_id IN (
  SELECT id FROM monitors WHERE user_id = auth.uid()
));

CREATE POLICY "System can insert SLA notifications" 
ON sla_notifications FOR INSERT 
WITH CHECK (true); -- Allow system inserts

-- Comment on table
COMMENT ON TABLE sla_notifications IS 'Tracks SLA breach notifications to prevent spam';
COMMENT ON COLUMN sla_notifications.breach_count IS 'Number of SLA targets breached';
COMMENT ON COLUMN sla_notifications.worst_uptime IS 'Worst uptime percentage among breached targets';
COMMENT ON COLUMN sla_notifications.breach_details IS 'JSON details of breached SLA targets';