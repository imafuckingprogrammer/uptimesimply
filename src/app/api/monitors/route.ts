import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const DEMO_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

export async function GET() {
  try {
    const { data: monitors, error } = await supabaseAdmin
      .from('monitors')
      .select('*')
      .eq('user_id', DEMO_USER_ID)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(monitors)
  } catch (error) {
    console.error('Error fetching monitors:', error)
    return NextResponse.json({ error: 'Failed to fetch monitors' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, name, alert_email, ssl_enabled, domain_enabled } = await request.json()

    if (!url || !name) {
      return NextResponse.json({ error: 'URL and name are required' }, { status: 400 })
    }

    const { data: monitor, error } = await supabaseAdmin
      .from('monitors')
      .insert({
        user_id: DEMO_USER_ID,
        url,
        name,
        alert_email: alert_email || `demo@example.com`,
        status: 'unknown',
        ssl_enabled: ssl_enabled !== false, // Default to true
        domain_enabled: domain_enabled !== false // Default to true
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(monitor, { status: 201 })
  } catch (error) {
    console.error('Error creating monitor:', error)
    return NextResponse.json({ error: 'Failed to create monitor' }, { status: 500 })
  }
}