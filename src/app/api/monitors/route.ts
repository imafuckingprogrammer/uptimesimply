import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { updateMonitorSSLInfo } from '@/lib/ssl-unified'

const DEMO_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

export async function GET() {
  try {
    const { data: monitors, error } = await supabaseAdmin!
      .from('monitors')
      .select('*')
      .eq('user_id', DEMO_USER_ID)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Decrypt sensitive data before returning
    const { decryptMonitorSecrets } = await import('@/lib/encryption')
    const decryptedMonitors = monitors?.map(monitor => decryptMonitorSecrets(monitor)) || []

    return NextResponse.json(decryptedMonitors)
  } catch (error) {
    const { createErrorResponse } = await import('@/lib/error-handler')
    return createErrorResponse(error, 500, 'GET /api/monitors')
  }
}

export async function POST(request: NextRequest) {
  try {
    const { 
      url, 
      name, 
      alert_email, 
      ssl_enabled, 
      domain_enabled,
      slack_webhook_url,
      discord_webhook_url,
      alert_sms,
      webhook_url
    } = await request.json()

    if (!url || !name) {
      return NextResponse.json({ error: 'URL and name are required' }, { status: 400 })
    }

    // Encrypt sensitive data before storing
    const { encryptMonitorSecrets } = await import('@/lib/encryption')
    const monitorData = {
      user_id: DEMO_USER_ID,
      url,
      name,
      alert_email: alert_email || `demo@example.com`,
      status: 'unknown',
      ssl_enabled: ssl_enabled !== false, // Default to true
      domain_enabled: domain_enabled !== false, // Default to true
      slack_webhook_url: slack_webhook_url || null,
      discord_webhook_url: discord_webhook_url || null,
      alert_sms: alert_sms || null,
      webhook_url: webhook_url || null,
      secrets_encrypted: true
    }
    
    const encryptedData = encryptMonitorSecrets(monitorData)
    
    const { data: monitor, error } = await supabaseAdmin!
      .from('monitors')
      .insert(encryptedData)
      .select()
      .single()

    if (error) throw error

    // Immediately check SSL if enabled
    if (monitor.ssl_enabled) {
      // Run SSL check in background - don't wait for it
      updateMonitorSSLInfo(monitor.id, monitor.url).catch(error => {
        console.error(`Background SSL check failed for monitor ${monitor.id}:`, error)
      })
    }

    return NextResponse.json(monitor, { status: 201 })
  } catch (error) {
    const { createErrorResponse } = await import('@/lib/error-handler')
    return createErrorResponse(error, 500, 'POST /api/monitors')
  }
}