import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendDownAlert, sendUpAlert } from '@/lib/email'
import { checkWebsiteHealth, checkPingHealth, checkPortHealth } from '@/lib/monitoring'
import { sendNotifications } from '@/lib/notifications'

const LOCATIONS = ['us-east', 'us-west', 'europe']
const USER_AGENTS = {
  'us-east': 'SimpleUptime/1.0 (US-East)',
  'us-west': 'SimpleUptime/1.0 (US-West)', 
  'europe': 'SimpleUptime/1.0 (Europe)'
}

async function checkMonitor(monitor: any, location: string) {
  const monitorType = monitor.monitor_type || 'http'
  
  try {
    let result
    
    switch (monitorType) {
      case 'ping':
        result = await checkPingHealth(monitor.url, 15000)
        break
        
      case 'port':
        const hostname = new URL(monitor.url).hostname
        const port = monitor.port_number || 80
        result = await checkPortHealth(hostname, port, 15000)
        break
        
      case 'http':
      default:
        // Parse custom headers
        let customHeaders = {}
        if (monitor.request_headers) {
          try {
            customHeaders = JSON.parse(monitor.request_headers)
          } catch (e) {
            console.warn(`Invalid headers for monitor ${monitor.id}:`, e)
          }
        }
        
        // Add location-specific user agent
        customHeaders = {
          'User-Agent': USER_AGENTS[location as keyof typeof USER_AGENTS],
          ...customHeaders
        }
        
        result = await checkWebsiteHealth({
          url: monitor.url,
          method: monitor.request_method || 'GET',
          headers: customHeaders,
          body: monitor.request_body || undefined,
          authType: monitor.auth_type || 'none',
          authUsername: monitor.auth_username || undefined,
          authPassword: monitor.auth_password || undefined,
          authToken: monitor.auth_token || undefined,
          timeoutMs: 15000
        })
        break
    }
    
    return {
      status: result.status,
      response_time: result.responseTime,
      status_code: result.statusCode,
      error_message: result.error
    }
  } catch (error: any) {
    return {
      status: 'error',
      response_time: 15000,
      status_code: null,
      error_message: error.message || 'Monitor check failed'
    }
  }
}

export async function GET() {
  return POST(new NextRequest('http://localhost:3000/api/cron/check-websites', { method: 'GET' }))
}

export async function POST(request: NextRequest) {
  try {
    // Verify this is a cron request (in production, check auth headers)
    const authHeader = request.headers.get('authorization')
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all active monitors
    const { data: monitors, error: monitorsError } = await supabaseAdmin
      .from('monitors')
      .select('*')

    if (monitorsError) throw monitorsError

    const results = []

    for (const monitor of monitors || []) {
      console.log(`Checking ${monitor.name} (${monitor.url})`)
      
      // Check from all locations
      const locationResults = await Promise.all(
        LOCATIONS.map(async (location) => {
          const result = await checkMonitor(monitor, location)
          
          // Store the check result
          await supabaseAdmin
            .from('uptime_checks')
            .insert({
              monitor_id: monitor.id,
              location,
              ...result
            })
          
          return { location, ...result }
        })
      )

      // Determine overall status (2+ locations must agree it's down)
      const downCount = locationResults.filter(r => r.status === 'down' || r.status === 'timeout' || r.status === 'error').length
      const newStatus = downCount >= 2 ? 'down' : 'up'
      
      // Calculate average response time for successful checks
      const successfulChecks = locationResults.filter(r => r.status === 'up' && r.response_time)
      const avgResponseTime = successfulChecks.length > 0 
        ? Math.round(successfulChecks.reduce((sum, r) => sum + r.response_time, 0) / successfulChecks.length)
        : null

      // Update monitor status
      const updateData: any = {
        last_checked: new Date().toISOString(),
        status: newStatus
      }

      if (avgResponseTime) {
        updateData.last_response_time = avgResponseTime
      }

      if (locationResults.some(r => r.status_code)) {
        updateData.last_status_code = locationResults.find(r => r.status_code)?.status_code
      }

      await supabaseAdmin
        .from('monitors')
        .update(updateData)
        .eq('id', monitor.id)

      // Handle incidents
      if (monitor.status !== newStatus) {
        if (newStatus === 'down' && monitor.status !== 'down') {
          // Site went down - create incident
          await supabaseAdmin
            .from('incidents')
            .insert({
              monitor_id: monitor.id,
              started_at: new Date().toISOString(),
              resolved: false,
              cause: locationResults.find(r => r.error_message)?.error_message || 'Unknown'
            })
          
          console.log(`🔴 ${monitor.name} went DOWN`)
          
          // Send notifications via all configured channels
          const notificationData = {
            monitorName: monitor.name,
            monitorUrl: monitor.url,
            status: 'down' as const,
            statusCode: locationResults.find(r => r.status_code)?.status_code,
            errorMessage: locationResults.find(r => r.error_message)?.error_message
          }
          
          const notificationResult = await sendNotifications(monitor, notificationData)
          
          if (notificationResult.success) {
            console.log(`📢 Down alerts sent via:`, Object.keys(notificationResult.results).join(', '))
          } else {
            console.error(`Failed to send down alerts:`, notificationResult.results)
          }
          
          // Also send traditional email for backward compatibility
          if (monitor.alert_email) {
            const alertResult = await sendDownAlert({
              recipient: monitor.alert_email,
              monitorName: monitor.name,
              monitorUrl: monitor.url,
              alertType: 'down',
              timestamp: new Date().toISOString(),
            })
            
            if (!alertResult.success) {
              console.error(`Failed to send email alert:`, alertResult.error)
            }
          }
        } else if (newStatus === 'up' && monitor.status === 'down') {
          // Site came back up - resolve incident
          const { data: openIncident } = await supabaseAdmin
            .from('incidents')
            .select('*')
            .eq('monitor_id', monitor.id)
            .eq('resolved', false)
            .order('started_at', { ascending: false })
            .limit(1)

          if (openIncident?.[0]) {
            const incident = openIncident[0]
            const durationMinutes = Math.round(
              (new Date().getTime() - new Date(incident.started_at).getTime()) / (1000 * 60)
            )

            await supabaseAdmin
              .from('incidents')
              .update({
                ended_at: new Date().toISOString(),
                duration_minutes: durationMinutes,
                resolved: true
              })
              .eq('id', incident.id)

            console.log(`🟢 ${monitor.name} came back UP (downtime: ${durationMinutes}m)`)
            
            // Send recovery notifications via all configured channels
            const notificationData = {
              monitorName: monitor.name,
              monitorUrl: monitor.url,
              status: 'up' as const,
              responseTime: avgResponseTime || undefined,
              downtime: `${durationMinutes} minutes`
            }
            
            const notificationResult = await sendNotifications(monitor, notificationData)
            
            if (notificationResult.success) {
              console.log(`📢 Recovery alerts sent via:`, Object.keys(notificationResult.results).join(', '))
            } else {
              console.error(`Failed to send recovery alerts:`, notificationResult.results)
            }
            
            // Also send traditional email for backward compatibility
            if (monitor.alert_email) {
              const alertResult = await sendUpAlert({
                recipient: monitor.alert_email,
                monitorName: monitor.name,
                monitorUrl: monitor.url,
                alertType: 'up',
                timestamp: new Date().toISOString(),
                incident: {
                  id: incident.id,
                  duration: durationMinutes,
                  cause: incident.cause
                }
              })
              
              if (!alertResult.success) {
                console.error(`Failed to send email alert:`, alertResult.error)
              }
            }
          }
        }
      }

      results.push({
        monitor: monitor.name,
        status: newStatus,
        checks: locationResults
      })
    }

    return NextResponse.json({ 
      success: true, 
      checked_at: new Date().toISOString(),
      results 
    })
  } catch (error) {
    console.error('Error in website check cron:', error)
    return NextResponse.json({ error: 'Failed to check websites' }, { status: 500 })
  }
}