import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }

    const monitorId = params.id
    const body = await request.json().catch(() => ({}))
    
    // Extract heartbeat data
    const {
      status = 'up',
      message,
      response_time,
      metadata = {}
    } = body

    // Get client IP for tracking
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'

    // Verify monitor exists and is heartbeat type
    const { data: monitor, error: monitorError } = await supabaseAdmin
      .from('monitors')
      .select('id, name, monitor_type, heartbeat_interval, last_heartbeat')
      .eq('id', monitorId)
      .single()

    if (monitorError || !monitor) {
      return NextResponse.json(
        { error: 'Monitor not found' },
        { status: 404 }
      )
    }

    // Ensure this is a heartbeat monitor
    if (monitor.monitor_type !== 'heartbeat') {
      return NextResponse.json(
        { error: 'Monitor is not configured for heartbeat monitoring' },
        { status: 400 }
      )
    }

    const now = new Date()

    // Record the heartbeat
    const { error: heartbeatError } = await supabaseAdmin
      .from('heartbeats')
      .insert({
        monitor_id: monitorId,
        status: status === 'up' ? 'up' : 'down',
        message: message || null,
        response_time: response_time || null,
        metadata: metadata,
        source_ip: clientIP,
        received_at: now.toISOString()
      })

    if (heartbeatError) {
      console.error('Failed to record heartbeat:', heartbeatError)
      return NextResponse.json(
        { error: 'Failed to record heartbeat' },
        { status: 500 }
      )
    }

    // Update monitor's last heartbeat and status
    const updateData: any = {
      last_heartbeat: now.toISOString(),
      last_checked: now.toISOString()
    }

    // Only update status if it's an "up" heartbeat
    // Down status will be handled by missed heartbeat detection
    if (status === 'up') {
      updateData.status = 'up'
      
      if (response_time) {
        updateData.last_response_time = response_time
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('monitors')
      .update(updateData)
      .eq('id', monitorId)

    if (updateError) {
      console.error('Failed to update monitor:', updateError)
    }

    // If this heartbeat indicates the service is back up after being down,
    // resolve any open incidents
    if (status === 'up') {
      const { data: openIncident } = await supabaseAdmin
        .from('incidents')
        .select('*')
        .eq('monitor_id', monitorId)
        .eq('resolved', false)
        .order('started_at', { ascending: false })
        .limit(1)

      if (openIncident?.[0]) {
        const incident = openIncident[0]
        const durationMinutes = Math.round(
          (now.getTime() - new Date(incident.started_at).getTime()) / (1000 * 60)
        )

        await supabaseAdmin
          .from('incidents')
          .update({
            ended_at: now.toISOString(),
            duration_minutes: durationMinutes,
            resolved: true,
            resolution_method: 'heartbeat'
          })
          .eq('id', incident.id)

        console.log(`🟢 Heartbeat resolved incident for ${monitor.name} (downtime: ${durationMinutes}m)`)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Heartbeat recorded successfully',
      next_expected: new Date(now.getTime() + (monitor.heartbeat_interval || 60) * 1000).toISOString()
    })

  } catch (error: any) {
    console.error('Error processing heartbeat:', error)
    return NextResponse.json(
      { error: 'Failed to process heartbeat' },
      { status: 500 }
    )
  }
}

// GET endpoint to provide heartbeat URL and instructions
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }

    const monitorId = params.id

    // Get monitor details
    const { data: monitor, error: monitorError } = await supabaseAdmin
      .from('monitors')
      .select('id, name, monitor_type, heartbeat_interval')
      .eq('id', monitorId)
      .single()

    if (monitorError || !monitor) {
      return NextResponse.json(
        { error: 'Monitor not found' },
        { status: 404 }
      )
    }

    if (monitor.monitor_type !== 'heartbeat') {
      return NextResponse.json(
        { error: 'Monitor is not configured for heartbeat monitoring' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const heartbeatUrl = `${baseUrl}/api/monitors/${monitorId}/heartbeat`

    return NextResponse.json({
      monitor: {
        id: monitor.id,
        name: monitor.name,
        type: monitor.monitor_type,
        interval: monitor.heartbeat_interval || 60
      },
      heartbeat_url: heartbeatUrl,
      instructions: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          status: 'up | down',
          message: 'Optional status message',
          response_time: 'Optional response time in ms',
          metadata: 'Optional object with additional data'
        },
        examples: {
          curl: `curl -X POST ${heartbeatUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"status": "up", "response_time": 150, "message": "All systems operational"}'`,
          javascript: `fetch('${heartbeatUrl}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'up',
    response_time: 150,
    message: 'All systems operational'
  })
})`,
          python: `import requests
requests.post('${heartbeatUrl}', json={
    'status': 'up',
    'response_time': 150,
    'message': 'All systems operational'
})`
        }
      }
    })

  } catch (error: any) {
    console.error('Error getting heartbeat info:', error)
    return NextResponse.json(
      { error: 'Failed to get heartbeat information' },
      { status: 500 }
    )
  }
}