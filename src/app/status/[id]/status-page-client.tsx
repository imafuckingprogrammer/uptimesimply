'use client'

import { useState, useEffect } from 'react'
import { StatusIndicator } from '@/components/StatusIndicator'
import { formatUptime, formatResponseTime, formatDuration } from '@/lib/utils'
import { Monitor, UptimeStats, Incident } from '@/types'
import { Clock, TrendingUp, AlertTriangle, RefreshCw, Calendar, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface StatusPageClientProps {
  initialMonitor: Monitor
  initialStats: UptimeStats
  initialIncidents: Incident[]
}

export function StatusPageClient({ initialMonitor, initialStats, initialIncidents }: StatusPageClientProps) {
  const [monitor, setMonitor] = useState(initialMonitor)
  const [stats, setStats] = useState(initialStats)
  const [incidents, setIncidents] = useState(initialIncidents)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      await refreshData()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const refreshData = async () => {
    setIsRefreshing(true)
    try {
      // Fetch updated monitor data
      const response = await fetch(`/api/monitors/${monitor.id}/stats`)
      if (response.ok) {
        const newStats = await response.json()
        setStats(newStats)
      }

      // Fetch updated monitor status
      const monitorResponse = await fetch(`/api/monitors/${monitor.id}`)
      if (monitorResponse.ok) {
        const monitorData = await monitorResponse.json()
        setMonitor(monitorData)
      }

      // Fetch recent incidents
      const incidentsResponse = await fetch(`/api/monitors/${monitor.id}/incidents`)
      if (incidentsResponse.ok) {
        const incidentsData = await incidentsResponse.json()
        setIncidents(incidentsData.slice(0, 10)) // Latest 10 incidents
      }

      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to refresh status page data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleManualRefresh = () => {
    refreshData()
  }

  const subscribeToUpdates = () => {
    // In a real implementation, this would open a subscription dialog
    alert('Status page subscriptions coming soon! You\'ll be able to get email/SMS updates when status changes.')
  }

  const getOverallStatus = () => {
    if (stats.current_incident) return 'degraded'
    if (monitor.status === 'down') return 'down'
    if (monitor.status === 'up') return 'operational'
    return 'unknown'
  }

  const getStatusMessage = () => {
    switch (getOverallStatus()) {
      case 'operational':
        return 'All systems operational'
      case 'degraded':
        return 'Service experiencing issues'
      case 'down':
        return 'Service unavailable'
      default:
        return 'Status unknown'
    }
  }

  const getStatusColor = () => {
    switch (getOverallStatus()) {
      case 'operational':
        return 'text-green-600'
      case 'degraded':
        return 'text-yellow-600'
      case 'down':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full px-6 py-8">
        {/* Header with branding and refresh */}
        <div className="bg-card rounded-lg shadow-sm border p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <StatusIndicator status={monitor.status} size="lg" />
              <div>
                <h1 className="text-3xl font-bold">{monitor.name}</h1>
                <p className="text-muted-foreground text-lg">{monitor.url}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={subscribeToUpdates}
                className="hidden sm:flex"
              >
                <Bell className="h-4 w-4 mr-2" />
                Subscribe
              </Button>
              <Button
                variant="outline" 
                size="sm"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Overall Status Banner */}
          <div className={`text-center py-4 mb-6 border rounded-lg ${
            getOverallStatus() === 'operational' ? 'bg-green-50 border-green-200' :
            getOverallStatus() === 'degraded' ? 'bg-yellow-50 border-yellow-200' :
            'bg-red-50 border-red-200'
          }`}>
            <div className={`text-xl font-semibold ${getStatusColor()}`}>
              {getStatusMessage()}
            </div>
            {getOverallStatus() === 'operational' && (
              <div className="text-sm text-green-700 mt-1">
                Service is running normally
              </div>
            )}
          </div>

          {/* Current Incident Alert */}
          {stats.current_incident && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-800">Active Incident</span>
              </div>
              <p className="text-red-700 mt-1">
                Service disruption started {' '}
                {new Date(stats.current_incident.started_at).toLocaleString()}
              </p>
              {stats.current_incident.cause && (
                <p className="text-red-600 text-sm mt-1">
                  <strong>Cause:</strong> {stats.current_incident.cause}
                </p>
              )}
              <div className="text-red-600 text-xs mt-2">
                Duration: {formatDuration(
                  Math.round((Date.now() - new Date(stats.current_incident.started_at).getTime()) / 60000)
                )}
              </div>
            </div>
          )}

          {/* Uptime Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {formatUptime(stats.uptime_24h)}
              </div>
              <div className="text-sm text-muted-foreground">Uptime (24h)</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {formatUptime(stats.uptime_7d)}
              </div>
              <div className="text-sm text-muted-foreground">Uptime (7d)</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-3xl font-bold text-green-600">
                {formatUptime(stats.uptime_30d)}
              </div>
              <div className="text-sm text-muted-foreground">Uptime (30d)</div>
            </div>
            <div className="text-center p-4 bg-background rounded-lg">
              <div className="text-3xl font-bold">
                {stats.avg_response_time > 0 ? formatResponseTime(stats.avg_response_time) : '-'}
              </div>
              <div className="text-sm text-muted-foreground">Avg Response</div>
            </div>
          </div>

          {/* Last Updated Info */}
          <div className="mt-6 pt-4 border-t flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Last checked: {monitor.last_checked ? new Date(monitor.last_checked).toLocaleString() : 'Never'}</span>
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <span>Updated: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Incident History */}
        {incidents.length > 0 && (
          <div className="bg-card rounded-lg shadow-sm border p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Incident History</h2>
              <div className="text-sm text-muted-foreground">
                Last {incidents.length} incidents
              </div>
            </div>
            <div className="space-y-4">
              {incidents.map((incident) => (
                <div key={incident.id} className="border rounded-lg p-4 hover:bg-background/50 transition-colors">
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground mb-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Started: {new Date(incident.started_at).toLocaleString()}</span>
                        </div>
                        {incident.ended_at && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Ended: {new Date(incident.ended_at).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                      {incident.cause && (
                        <p className="text-sm bg-background p-2 rounded border-l-4 border-gray-300">
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

        {/* No Incidents Message */}
        {incidents.length === 0 && (
          <div className="bg-card rounded-lg shadow-sm border p-8 text-center">
            <div className="text-green-600 mb-4">
              <TrendingUp className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Recent Incidents</h3>
            <p className="text-muted-foreground">
              This service has been running smoothly with no reported incidents.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Powered by SimpleUptime • Auto-refreshes every 30 seconds</p>
          <p className="mt-1">
            Monitor Type: {monitor.monitor_type || 'HTTP'} • Check Interval: {monitor.check_interval || 5} minutes
          </p>
        </div>
      </div>
    </div>
  )
}