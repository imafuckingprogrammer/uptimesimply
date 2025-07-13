import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendNotifications } from '@/lib/notifications'

export async function GET() {
  return POST(new NextRequest('http://localhost:3000/api/cron/check-heartbeats', { method: 'GET' }))
}

export async function POST(request: NextRequest) {
  try {
    // Verify this is a cron request (in production, check auth headers)
    const authHeader = request.headers.get('authorization')
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }

    console.log('🔍 Checking for missed heartbeats...')

    // Get all heartbeat monitors
    const { data: monitors, error: monitorsError } = await supabaseAdmin
      .from('monitors')
      .select('*')
      .eq('monitor_type', 'heartbeat')

    if (monitorsError) {
      throw monitorsError
    }

    const results = []
    const now = new Date()

    for (const monitor of monitors || []) {
      try {
        const heartbeatInterval = monitor.heartbeat_interval || 60 // seconds
        const gracePeriod = Math.max(30, heartbeatInterval * 0.5) // 50% grace period, min 30s
        const missedThreshold = now.getTime() - (heartbeatInterval + gracePeriod) * 1000

        const lastHeartbeat = monitor.last_heartbeat ? new Date(monitor.last_heartbeat) : null
        const isOverdue = !lastHeartbeat || lastHeartbeat.getTime() < missedThreshold

        console.log(`📋 ${monitor.name}: Last heartbeat ${lastHeartbeat ? lastHeartbeat.toISOString() : 'never'}, Expected every ${heartbeatInterval}s, Grace ${gracePeriod}s, Overdue: ${isOverdue}`)

        if (isOverdue && monitor.status !== 'down') {
          // Heartbeat is missed and monitor isn't already marked down
          console.log(`💔 Missed heartbeat for ${monitor.name} - marking as down`)

          // Update monitor status to down
          await supabaseAdmin
            .from('monitors')
            .update({
              status: 'down',
              last_checked: now.toISOString()
            })
            .eq('id', monitor.id)

          // Create incident for missed heartbeat
          const { data: incident, error: incidentError } = await supabaseAdmin
            .from('incidents')
            .insert({
              monitor_id: monitor.id,
              started_at: now.toISOString(),
              resolved: false,
              cause: `Missed heartbeat (expected every ${heartbeatInterval}s, last seen ${lastHeartbeat ? Math.round((now.getTime() - lastHeartbeat.getTime()) / 1000) : 'never'}s ago)`,
              incident_type: 'missed_heartbeat'
            })
            .select()
            .single()

          if (incidentError) {
            console.error('Failed to create missed heartbeat incident:', incidentError)
          }

          // Send notifications
          const notificationData = {
            monitorName: monitor.name,
            monitorUrl: monitor.url || 'Heartbeat Monitor',
            status: 'down' as const,
            errorMessage: `Missed heartbeat - last check ${lastHeartbeat ? Math.round((now.getTime() - lastHeartbeat.getTime()) / 1000) : 'never'}s ago`
          }

          const notificationResult = await sendNotifications(monitor, notificationData)

          if (notificationResult.success) {
            console.log(`📢 Missed heartbeat alerts sent via:`, Object.keys(notificationResult.results).join(', '))
          } else {
            console.error(`Failed to send missed heartbeat alerts:`, notificationResult.results)
          }

          results.push({
            monitor: monitor.name,
            status: 'missed_heartbeat',
            last_heartbeat: lastHeartbeat?.toISOString(),
            overdue_by_seconds: lastHeartbeat ? Math.round((now.getTime() - lastHeartbeat.getTime()) / 1000) : 'never'
          })
        } else if (!isOverdue && monitor.status === 'down') {
          // Heartbeat is current but monitor is marked down - this might be stale
          // We'll let the actual heartbeat endpoint handle recovery
          console.log(`⏰ ${monitor.name} status is down but heartbeat window is current - waiting for actual heartbeat`)
        } else {
          // Heartbeat is on time
          results.push({
            monitor: monitor.name,
            status: 'on_time',
            last_heartbeat: lastHeartbeat?.toISOString(),
            next_expected: new Date(now.getTime() + heartbeatInterval * 1000).toISOString()
          })
        }
      } catch (error) {
        console.error(`Error checking heartbeat for ${monitor.name}:`, error)
        results.push({
          monitor: monitor.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const missedCount = results.filter(r => r.status === 'missed_heartbeat').length
    const onTimeCount = results.filter(r => r.status === 'on_time').length

    console.log(`✅ Heartbeat check complete: ${onTimeCount} on time, ${missedCount} missed`)

    return NextResponse.json({
      success: true,
      checked_at: now.toISOString(),
      summary: {
        total_monitors: monitors?.length || 0,
        on_time: onTimeCount,
        missed: missedCount,
        errors: results.filter(r => r.status === 'error').length
      },
      results
    })

  } catch (error) {
    console.error('Error in heartbeat check cron:', error)
    return NextResponse.json({ error: 'Failed to check heartbeats' }, { status: 500 })
  }
}