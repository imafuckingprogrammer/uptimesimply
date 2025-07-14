import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import { StatusIndicator } from '@/components/StatusIndicator'
import { formatUptime, formatResponseTime, formatDuration } from '@/lib/utils'
import { Monitor, UptimeStats, Incident } from '@/types'
import { Clock, TrendingUp, AlertTriangle } from 'lucide-react'

interface PageProps {
  params: { id: string }
}

async function getMonitorData(id: string) {
  const { data: monitor, error } = await supabaseAdmin!
    .from('monitors')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !monitor) {
    return null
  }

  // Check if status page is public
  if (monitor.status_page_public === false) {
    return { isPrivate: true }
  }

  // Get uptime stats
  const now = new Date()
  const day24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const { data: checks24h } = await supabaseAdmin!
    .from('uptime_checks')
    .select('status, response_time')
    .eq('monitor_id', id)
    .gte('checked_at', day24Ago.toISOString())

  const { data: checks7d } = await supabaseAdmin!
    .from('uptime_checks')
    .select('status')
    .eq('monitor_id', id)
    .gte('checked_at', days7Ago.toISOString())

  const { data: checks30d } = await supabaseAdmin!
    .from('uptime_checks')
    .select('status')
    .eq('monitor_id', id)
    .gte('checked_at', days30Ago.toISOString())

  // Get recent incidents
  const { data: incidents } = await supabaseAdmin!
    .from('incidents')
    .select('*')
    .eq('monitor_id', id)
    .order('started_at', { ascending: false })
    .limit(10)

  // Calculate uptime percentages
  const calculateUptime = (checks: any[]) => {
    if (!checks || checks.length === 0) return null
    const upChecks = checks.filter(check => check.status === 'up').length
    return (upChecks / checks.length) * 100
  }

  // Calculate average response time
  const validResponseTimes = checks24h?.filter(check => 
    check.response_time && check.status === 'up'
  ).map(check => check.response_time) || []
  
  const avgResponseTime = validResponseTimes.length > 0 
    ? validResponseTimes.reduce((sum, time) => sum + time, 0) / validResponseTimes.length
    : 0

  const stats: UptimeStats = {
    uptime_24h: calculateUptime(checks24h || []),
    uptime_7d: calculateUptime(checks7d || []),
    uptime_30d: calculateUptime(checks30d || []),
    avg_response_time: Math.round(avgResponseTime),
    total_incidents: incidents?.length || 0,
    current_incident: incidents?.find(i => !i.resolved) || null
  }

  return { monitor, stats, incidents: incidents || [] }
}

export default async function StatusPage({ params }: PageProps) {
  const data = await getMonitorData(params.id)

  if (!data) {
    notFound()
  }

  // Handle private status pages
  if ('isPrivate' in data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card rounded-lg shadow-sm border p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2">Private Status Page</h1>
            <p className="text-muted-foreground mb-6">
              This status page is private and not publicly accessible.
            </p>
            <p className="text-sm text-muted-foreground">
              If you're the owner, you can make it public in your monitor settings.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const { monitor, stats, incidents } = data

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full px-6 py-8">
        {/* Header */}
        <div className="bg-card rounded-lg shadow-sm border p-8 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <StatusIndicator status={monitor.status} size="lg" />
            <div>
              <h1 className="text-3xl font-bold">{monitor.name}</h1>
              <p className="text-muted-foreground text-lg">{monitor.url}</p>
            </div>
          </div>

          {stats.current_incident && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-800">Service Disruption</span>
              </div>
              <p className="text-red-700 mt-1">
                This service has been experiencing issues since{' '}
                {new Date(stats.current_incident.started_at).toLocaleString()}
              </p>
              {stats.current_incident.cause && (
                <p className="text-red-600 text-sm mt-1">
                  Cause: {stats.current_incident.cause}
                </p>
              )}
            </div>
          )}

          {/* Uptime Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {formatUptime(stats.uptime_24h)}
              </div>
              <div className="text-sm text-muted-foreground">Uptime (24h)</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {formatUptime(stats.uptime_7d)}
              </div>
              <div className="text-sm text-muted-foreground">Uptime (7d)</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {formatUptime(stats.uptime_30d)}
              </div>
              <div className="text-sm text-muted-foreground">Uptime (30d)</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold">
                {stats.avg_response_time > 0 ? formatResponseTime(stats.avg_response_time) : '-'}
              </div>
              <div className="text-sm text-muted-foreground">Avg Response</div>
            </div>
          </div>

          {monitor.last_checked && (
            <div className="mt-6 pt-4 border-t text-sm text-muted-foreground">
              Last checked: {new Date(monitor.last_checked).toLocaleString()}
            </div>
          )}
        </div>

        {/* Incident History */}
        {incidents.length > 0 && (
          <div className="bg-card rounded-lg shadow-sm border p-8">
            <h2 className="text-xl font-semibold mb-6">Incident History</h2>
            <div className="space-y-4">
              {incidents.map((incident) => (
                <div key={incident.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${incident.resolved ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="font-medium">
                          {incident.resolved ? 'Resolved' : 'Ongoing'} Incident
                        </span>
                        {incident.duration_minutes && (
                          <span className="text-sm text-muted-foreground">
                            ({formatDuration(incident.duration_minutes)})
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Started: {new Date(incident.started_at).toLocaleString()}
                      </p>
                      {incident.ended_at && (
                        <p className="text-sm text-muted-foreground mb-1">
                          Ended: {new Date(incident.ended_at).toLocaleString()}
                        </p>
                      )}
                      {incident.cause && (
                        <p className="text-sm">
                          <span className="font-medium">Cause:</span> {incident.cause}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Powered by SimpleUptime • Updated every 5 minutes</p>
        </div>
      </div>
    </div>
  )
}