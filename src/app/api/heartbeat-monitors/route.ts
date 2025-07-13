import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const DEMO_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

export async function GET() {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }

    const { data: monitors, error } = await supabaseAdmin
      .from('monitors')
      .select('*')
      .eq('user_id', DEMO_USER_ID)
      .eq('monitor_type', 'heartbeat')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(monitors)
  } catch (error) {
    console.error('Error fetching heartbeat monitors:', error)
    return NextResponse.json({ error: 'Failed to fetch heartbeat monitors' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }

    const { 
      name, 
      description,
      heartbeat_interval = 60,
      alert_email,
      slack_webhook_url,
      discord_webhook_url,
      alert_sms,
      webhook_url
    } = await request.json()

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (heartbeat_interval < 30 || heartbeat_interval > 3600) {
      return NextResponse.json({ 
        error: 'Heartbeat interval must be between 30 seconds and 1 hour' 
      }, { status: 400 })
    }

    const { data: monitor, error } = await supabaseAdmin
      .from('monitors')
      .insert({
        user_id: DEMO_USER_ID,
        name,
        url: `heartbeat://${name.toLowerCase().replace(/\s+/g, '-')}`,
        monitor_type: 'heartbeat',
        heartbeat_interval,
        description: description || null,
        alert_email: alert_email || `demo@example.com`,
        status: 'unknown',
        ssl_enabled: false,
        domain_enabled: false,
        slack_webhook_url: slack_webhook_url || null,
        discord_webhook_url: discord_webhook_url || null,
        alert_sms: alert_sms || null,
        webhook_url: webhook_url || null
      })
      .select()
      .single()

    if (error) throw error

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const heartbeatUrl = `${baseUrl}/api/monitors/${monitor.id}/heartbeat`

    return NextResponse.json({
      ...monitor,
      heartbeat_url: heartbeatUrl,
      instructions: {
        interval: heartbeat_interval,
        url: heartbeatUrl,
        method: 'POST',
        example_curl: `curl -X POST ${heartbeatUrl} -H "Content-Type: application/json" -d '{"status": "up"}'`
      }
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating heartbeat monitor:', error)
    return NextResponse.json({ error: 'Failed to create heartbeat monitor' }, { status: 500 })
  }
}