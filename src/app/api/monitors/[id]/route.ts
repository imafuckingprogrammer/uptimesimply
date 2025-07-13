import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const DEMO_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { data: monitor, error } = await supabaseAdmin!
      .from('monitors')
      .select('*')
      .eq('id', id)
      .eq('user_id', DEMO_USER_ID)
      .single()

    if (error || !monitor) {
      return NextResponse.json({ error: 'Monitor not found' }, { status: 404 })
    }

    return NextResponse.json(monitor)
  } catch (error) {
    console.error('Error fetching monitor:', error)
    return NextResponse.json({ error: 'Failed to fetch monitor' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const {
      name,
      alert_email,
      ssl_enabled,
      domain_enabled,
      monitor_type,
      request_method,
      request_headers,
      auth_type,
      auth_username,
      auth_password,
      auth_token,
      port_number,
      slack_webhook_url,
      discord_webhook_url,
      alert_sms,
      webhook_url,
      notification_channels
    } = await request.json()
    const { id } = params

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Automatically configure notification channels based on provided URLs
    const finalNotificationChannels = ['email']
    if (slack_webhook_url) finalNotificationChannels.push('slack')
    if (discord_webhook_url) finalNotificationChannels.push('discord')
    if (alert_sms) finalNotificationChannels.push('sms')
    if (webhook_url) finalNotificationChannels.push('webhook')

    const updateData: any = {
      name,
      alert_email,
      ssl_enabled: ssl_enabled !== false,
      domain_enabled: domain_enabled !== false,
      notification_channels: finalNotificationChannels
    }

    // Only update enhanced fields if they are provided
    if (monitor_type) updateData.monitor_type = monitor_type
    if (request_method) updateData.request_method = request_method
    if (request_headers !== undefined) updateData.request_headers = request_headers
    if (auth_type) updateData.auth_type = auth_type
    if (auth_username !== undefined) updateData.auth_username = auth_username
    if (auth_password !== undefined) updateData.auth_password = auth_password
    if (auth_token !== undefined) updateData.auth_token = auth_token
    if (port_number !== undefined) updateData.port_number = port_number
    if (slack_webhook_url !== undefined) updateData.slack_webhook_url = slack_webhook_url
    if (discord_webhook_url !== undefined) updateData.discord_webhook_url = discord_webhook_url
    if (alert_sms !== undefined) updateData.alert_sms = alert_sms
    if (webhook_url !== undefined) updateData.webhook_url = webhook_url

    const { data: monitor, error } = await supabaseAdmin!
      .from('monitors')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', DEMO_USER_ID)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(monitor)
  } catch (error) {
    console.error('Error updating monitor:', error)
    return NextResponse.json({ error: 'Failed to update monitor' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { error } = await supabaseAdmin!
      .from('monitors')
      .delete()
      .eq('id', id)
      .eq('user_id', DEMO_USER_ID)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting monitor:', error)
    return NextResponse.json({ error: 'Failed to delete monitor' }, { status: 500 })
  }
}