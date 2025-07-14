export interface Monitor {
  id: string
  user_id: string
  url: string
  name: string
  status: 'up' | 'down' | 'unknown'
  created_at: string
  alert_email?: string
  check_interval: number
  last_checked?: string
  last_status_code?: number
  last_response_time?: number
  ssl_enabled?: boolean
  ssl_expiry_date?: string
  ssl_issuer?: string
  ssl_days_until_expiry?: number
  ssl_grade?: string
  ssl_has_warnings?: boolean
  ssl_vulnerabilities?: string[]
  domain_enabled?: boolean
  domain_expiry_date?: string
  domain_registrar?: string
  domain_days_until_expiry?: number
  // Enhanced monitoring features
  monitor_type?: 'http' | 'ping' | 'port'
  request_method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'
  request_headers?: string // JSON string of headers
  request_body?: string
  auth_type?: 'none' | 'basic' | 'bearer' | 'header'
  auth_username?: string
  auth_password?: string
  auth_token?: string
  port_number?: number
  notification_channels?: string[] // ['email', 'slack', 'sms', 'discord', 'webhook']
  slack_webhook_url?: string
  discord_webhook_url?: string
  webhook_url?: string
  alert_sms?: string
  // Status page visibility
  status_page_public?: boolean
}

export interface UptimeCheck {
  id: string
  monitor_id: string
  location: 'us-east' | 'us-west' | 'europe'
  status: 'up' | 'down' | 'timeout' | 'error'
  response_time?: number
  status_code?: number
  error_message?: string
  checked_at: string
}

export interface Incident {
  id: string
  monitor_id: string
  started_at: string
  ended_at?: string
  duration_minutes?: number
  cause?: string
  resolved: boolean
}

export interface AlertSent {
  id: string
  monitor_id: string
  incident_id?: string
  alert_type: 'down' | 'up'
  recipient: string
  sent_at: string
  delivery_status: string
}

export interface Profile {
  id: string
  email: string
  created_at: string
  subscription_status: string
  trial_ends_at: string
}

export interface UptimeStats {
  uptime_24h: number | null
  uptime_7d: number | null
  uptime_30d: number | null
  avg_response_time: number
  total_incidents: number
  current_incident?: Incident
}