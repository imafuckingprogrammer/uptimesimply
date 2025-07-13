import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendDownAlert, sendUpAlert, sendSlackAlert, sendDiscordAlert } from '@/lib/email'
import { checkWebsiteHealth, checkPingHealth, checkPortHealth } from '@/lib/monitoring'
import { sendNotifications } from '@/lib/notifications'
import { runNetworkDiagnostics, type NetworkDiagnostics } from '@/lib/network-diagnostics'

const LOCATIONS = ['us-east', 'us-west', 'europe', 'asia-pacific', 'south-america']
const USER_AGENTS = {
  'us-east': 'SimpleUptime/1.0 (US-East)',
  'us-west': 'SimpleUptime/1.0 (US-West)', 
  'europe': 'SimpleUptime/1.0 (Europe)',
  'asia-pacific': 'SimpleUptime/1.0 (Asia-Pacific)',
  'south-america': 'SimpleUptime/1.0 (South-America)'
}

async function checkMonitor(monitor: any, location: string) {
  const monitorType = monitor.monitor_type || 'http'
  
  try {
    let result: any
    
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

    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
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
          await supabaseAdmin!
            .from('uptime_checks')
            .insert({
              monitor_id: monitor.id,
              location,
              ...result
            })
          
          return { location, ...result }
        })
      )

      // Determine overall status (3+ locations must agree it's down for 5 locations)
      const downCount = locationResults.filter(r => r.status === 'down' || r.status === 'timeout' || r.status === 'error').length
      const newStatus = downCount >= 3 ? 'down' : 'up'
      
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

      await supabaseAdmin!
        .from('monitors')
        .update(updateData)
        .eq('id', monitor.id)

      // Handle incidents
      if (monitor.status !== newStatus) {
        if (newStatus === 'down' && monitor.status !== 'down') {
          // Site went down - create incident
          const { data: incident, error: incidentError } = await supabaseAdmin!
            .from('incidents')
            .insert({
              monitor_id: monitor.id,
              started_at: new Date().toISOString(),
              resolved: false,
              cause: locationResults.find(r => r.error_message)?.error_message || 'Unknown'
            })
            .select()
            .single()
          
          if (incidentError) {
            console.error('Failed to create incident:', incidentError)
          } else {
            console.log(`🔴 ${monitor.name} went DOWN - capturing diagnostics...`)
            
            // Capture enhanced network diagnostics for each location that failed
            const failedLocations = locationResults
              .filter(r => r.status === 'down' || r.status === 'timeout' || r.status === 'error')
              .map(r => r.location)
            
            // Run diagnostics for failed locations (limit to prevent overload)
            const diagnosticsPromises = failedLocations.slice(0, 2).map(async (location) => {
              try {
                console.log(`🔬 Running diagnostics for ${monitor.name} from ${location}`)
                const diagnostics = await runNetworkDiagnostics(monitor.url, location)
                await storeDiagnostics(incident.id, monitor.id, location, diagnostics)
              } catch (error) {
                console.error(`Failed to capture diagnostics for ${location}:`, error)
              }
            })
            
            // Don't wait for diagnostics to complete - run in background
            Promise.all(diagnosticsPromises).catch(error => {
              console.error('Diagnostics capture failed:', error)
            })
          }
          
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
          
          // Send notifications via all configured channels
          const alertMessage = `${monitor.name} (${monitor.url}) is DOWN`
          
          // Email alert
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
          
          // Slack alert
          if (monitor.slack_webhook_url) {
            const slackResult = await sendSlackAlert(monitor.slack_webhook_url, alertMessage, 'down')
            if (!slackResult.success) {
              console.error(`Failed to send Slack alert:`, slackResult.error)
            }
          }
          
          // Discord alert  
          if (monitor.discord_webhook_url) {
            const discordResult = await sendDiscordAlert(monitor.discord_webhook_url, alertMessage, 'down')
            if (!discordResult.success) {
              console.error(`Failed to send Discord alert:`, discordResult.error)
            }
          }
        } else if (newStatus === 'up' && monitor.status === 'down') {
          // Site came back up - resolve incident
          const { data: openIncident } = await supabaseAdmin!
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

            await supabaseAdmin!
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
            
            // Send recovery notifications via all configured channels
            const recoveryMessage = `${monitor.name} (${monitor.url}) is back UP after ${durationMinutes} minutes`
            
            // Email alert
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
            
            // Slack alert
            if (monitor.slack_webhook_url) {
              const slackResult = await sendSlackAlert(monitor.slack_webhook_url, recoveryMessage, 'up')
              if (!slackResult.success) {
                console.error(`Failed to send Slack recovery alert:`, slackResult.error)
              }
            }
            
            // Discord alert
            if (monitor.discord_webhook_url) {
              const discordResult = await sendDiscordAlert(monitor.discord_webhook_url, recoveryMessage, 'up')
              if (!discordResult.success) {
                console.error(`Failed to send Discord recovery alert:`, discordResult.error)
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

// Helper function to store network diagnostics in database
async function storeDiagnostics(incidentId: string, monitorId: string, location: string, diagnostics: NetworkDiagnostics) {
  try {
    const { error } = await supabaseAdmin!
      .from('incident_diagnostics')
      .insert({
        incident_id: incidentId,
        monitor_id: monitorId,
        location: location,
        
        // DNS Resolution Data
        dns_success: diagnostics.dns_resolution.success,
        dns_resolved_ips: diagnostics.dns_resolution.resolved_ips,
        dns_resolution_time_ms: diagnostics.dns_resolution.resolution_time_ms,
        dns_nameservers: diagnostics.dns_resolution.nameservers,
        dns_errors: diagnostics.dns_resolution.dns_errors,
        dns_cname_chain: diagnostics.dns_resolution.cname_chain,
        dns_mx_records: diagnostics.dns_resolution.mx_records,
        dns_txt_records: diagnostics.dns_resolution.txt_records,
        
        // Traceroute Data
        traceroute_success: diagnostics.traceroute.success,
        traceroute_total_hops: diagnostics.traceroute.total_hops,
        traceroute_total_time_ms: diagnostics.traceroute.total_time_ms,
        traceroute_packet_loss: diagnostics.traceroute.packet_loss,
        traceroute_hops: diagnostics.traceroute.hops,
        
        // HTTP Diagnostics
        http_connection_time_ms: diagnostics.http_details.connection_time_ms,
        http_ssl_handshake_time_ms: diagnostics.http_details.ssl_handshake_time_ms,
        http_first_byte_time_ms: diagnostics.http_details.first_byte_time_ms,
        http_total_time_ms: diagnostics.http_details.total_time_ms,
        http_response_headers: diagnostics.http_details.response_headers,
        http_status_code: diagnostics.http_details.status_code,
        http_status_text: diagnostics.http_details.status_text,
        http_response_size_bytes: diagnostics.http_details.response_size_bytes,
        http_redirect_chain: diagnostics.http_details.redirect_chain,
        http_content_type: diagnostics.http_details.content_type,
        http_server_info: diagnostics.http_details.server_info,
        http_error_details: diagnostics.http_details.error_details,
        
        // SSL/TLS Diagnostics
        ssl_certificate_valid: diagnostics.ssl_verification.certificate_valid,
        ssl_certificate_chain_length: diagnostics.ssl_verification.certificate_chain_length,
        ssl_cipher_suite: diagnostics.ssl_verification.cipher_suite,
        ssl_tls_version: diagnostics.ssl_verification.tls_version,
        ssl_certificate_issuer: diagnostics.ssl_verification.certificate_issuer,
        ssl_certificate_expiry: diagnostics.ssl_verification.certificate_expiry,
        ssl_san_domains: diagnostics.ssl_verification.san_domains,
        ssl_errors: diagnostics.ssl_verification.ssl_errors,
        ssl_ocsp_status: diagnostics.ssl_verification.ocsp_status,
        
        // Geographic Analysis
        geo_server_country: diagnostics.geo_analysis.server_location.country,
        geo_server_city: diagnostics.geo_analysis.server_location.city,
        geo_server_latitude: diagnostics.geo_analysis.server_location.latitude,
        geo_server_longitude: diagnostics.geo_analysis.server_location.longitude,
        geo_is_cdn: diagnostics.geo_analysis.cdn_detection.is_cdn,
        geo_cdn_provider: diagnostics.geo_analysis.cdn_detection.cdn_provider,
        geo_edge_location: diagnostics.geo_analysis.cdn_detection.edge_location,
        geo_asn: diagnostics.geo_analysis.network_info.asn,
        geo_isp: diagnostics.geo_analysis.network_info.isp,
        geo_organization: diagnostics.geo_analysis.network_info.organization,
        
        // Metadata
        captured_at: new Date().toISOString(),
        diagnostic_version: '1.0'
      })
    
    if (error) {
      console.error('Failed to store diagnostics:', error)
    } else {
      console.log(`✅ Stored diagnostics for incident ${incidentId} from ${location}`)
    }
  } catch (error) {
    console.error('Error storing diagnostics:', error)
  }
}