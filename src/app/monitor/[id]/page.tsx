'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Monitor, UptimeStats } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusIndicator } from '@/components/StatusIndicator'
import { UptimeChart } from '@/components/UptimeChart'
import { ResponseTimeChart } from '@/components/ResponseTimeChart'
import { StatusDistributionChart } from '@/components/StatusDistributionChart'
import { PerformanceTrendsChart } from '@/components/PerformanceTrendsChart'
import { ResponseTimeDistributionChart } from '@/components/ResponseTimeDistributionChart'
import { IncidentTimeline } from '@/components/IncidentTimeline'
import { SLADashboard } from '@/components/SLADashboard'
import { LoadingState } from '@/components/ui/loader'
import { formatUptime, formatResponseTime } from '@/lib/utils'
import { ArrowLeft, ExternalLink, Calendar, BarChart3, AlertTriangle, Shield, Target } from 'lucide-react'

interface PageProps {
  params: { id: string }
}

export default function MonitorDetailsPage({ params }: PageProps) {
  const router = useRouter()
  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [stats, setStats] = useState<UptimeStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [chartDays, setChartDays] = useState(7)
  const [chartMode, setChartMode] = useState<'days' | 'today'>('days')
  const [showSLA, setShowSLA] = useState(false)

  useEffect(() => {
    fetchMonitorData()
  }, [params.id])

  const fetchMonitorData = async () => {
    try {
      const [monitorResponse, statsResponse] = await Promise.all([
        fetch(`/api/monitors/${params.id}`),
        fetch(`/api/monitors/${params.id}/stats`)
      ])

      if (monitorResponse.ok && statsResponse.ok) {
        const monitorData = await monitorResponse.json()
        const statsData = await statsResponse.json()
        setMonitor(monitorData)
        setStats(statsData)
      } else {
        router.push('/') // Redirect if monitor not found
      }
    } catch (error) {
      console.error('Failed to fetch monitor data:', error)
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingState size="lg" fullScreen />
  }

  if (!monitor || !stats) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-muted-foreground">Monitor not found</h2>
        <Button onClick={() => router.push('/')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <StatusIndicator status={monitor.status} size="lg" />
            <div>
              <h1 className="text-2xl font-bold">{monitor.name}</h1>
              <p className="text-muted-foreground">{monitor.url}</p>
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={() => window.open(monitor.url, '_blank')}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Visit Site
        </Button>
        {monitor.ssl_enabled && (
          <Button variant="outline" onClick={() => router.push(`/monitor/${monitor.id}/ssl`)}>
            <Shield className="h-4 w-4 mr-2" />
            SSL Details
          </Button>
        )}
        <Button variant="outline" onClick={() => setShowSLA(!showSLA)}>
          <Target className="h-4 w-4 mr-2" />
          {showSLA ? 'Hide' : 'Show'} SLA
        </Button>
        <Button variant="outline" onClick={() => window.open(`/status/${monitor.id}`, '_blank')}>
          View Public Status
        </Button>
      </div>

      {/* Current Incident Alert */}
      {stats.current_incident && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="font-medium text-red-800">Service Disruption</span>
            </div>
            <p className="text-red-700">
              This service has been experiencing issues since{' '}
              {new Date(stats.current_incident.started_at).toLocaleString()}
            </p>
            {stats.current_incident.cause && (
              <p className="text-red-600 text-sm mt-1">
                Cause: {stats.current_incident.cause}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">24h Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatUptime(stats.uptime_24h)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">7d Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatUptime(stats.uptime_7d)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">30d Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatUptime(stats.uptime_30d)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.avg_response_time > 0 ? formatResponseTime(stats.avg_response_time) : '-'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SLA Dashboard */}
      {showSLA && (
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Target className="h-5 w-5" />
            Service Level Agreement (SLA) Monitoring
          </h2>
          <SLADashboard monitorId={monitor.id} />
        </div>
      )}

      {/* Uptime Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Uptime Trend
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={chartMode === 'today' ? "default" : "outline"}
                size="sm"
                onClick={() => setChartMode('today')}
              >
                Today
              </Button>
              {[7, 14, 30].map(days => (
                <Button
                  key={days}
                  variant={chartMode === 'days' && chartDays === days ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setChartMode('days')
                    setChartDays(days)
                  }}
                >
                  {days}d
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <UptimeChart 
            monitorId={monitor.id} 
            days={chartMode === 'days' ? chartDays : undefined}
            hours={chartMode === 'today' ? 24 : undefined}
          />
        </CardContent>
      </Card>

      {/* Response Time Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Response Time Trend
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={chartMode === 'today' ? "default" : "outline"}
                size="sm"
                onClick={() => setChartMode('today')}
              >
                Today
              </Button>
              {[7, 14, 30].map(days => (
                <Button
                  key={days}
                  variant={chartMode === 'days' && chartDays === days ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setChartMode('days')
                    setChartDays(days)
                  }}
                >
                  {days}d
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponseTimeChart 
            monitorId={monitor.id} 
            days={chartMode === 'days' ? chartDays : undefined}
            hours={chartMode === 'today' ? 24 : undefined}
          />
        </CardContent>
      </Card>

      {/* Advanced Analytics Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Advanced Analytics</h2>
        </div>
        
        {/* Performance Overview - Two charts side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StatusDistributionChart 
            monitorId={monitor.id} 
            period={chartMode === 'today' ? '1d' : `${chartDays}d`}
          />
          <ResponseTimeDistributionChart 
            monitorId={monitor.id}
          />
        </div>
        
        {/* Performance Trends - Full width */}
        <PerformanceTrendsChart 
          monitorId={monitor.id}
        />
      </div>

      {/* Incident Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Incident History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <IncidentTimeline monitorId={monitor.id} />
        </CardContent>
      </Card>

      {/* Monitor Info */}
      <Card>
        <CardHeader>
          <CardTitle>Monitor Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-muted-foreground">Alert Email:</span>
              <span className="ml-2">{monitor.alert_email}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Check Interval:</span>
              <span className="ml-2">{monitor.check_interval} minutes</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Created:</span>
              <span className="ml-2">{new Date(monitor.created_at).toLocaleString()}</span>
            </div>
            <div>
              <span className="font-medium text-muted-foreground">Last Checked:</span>
              <span className="ml-2">
                {monitor.last_checked 
                  ? new Date(monitor.last_checked).toLocaleString()
                  : 'Never'
                }
              </span>
            </div>
            {monitor.ssl_enabled && (
              <>
                <div>
                  <span className="font-medium text-muted-foreground">SSL Grade:</span>
                  <span className="ml-2">
                    {monitor.ssl_grade ? (
                      <span className={`px-2 py-1 rounded text-sm font-medium ${
                        monitor.ssl_grade.startsWith('A') ? 'bg-green-100 text-green-700' :
                        monitor.ssl_grade.startsWith('B') ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {monitor.ssl_grade}
                      </span>
                    ) : (
                      'Checking...'
                    )}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">SSL Expiry:</span>
                  <span className={`ml-2 ${
                    monitor.ssl_days_until_expiry && monitor.ssl_days_until_expiry <= 7 ? 'text-red-600 font-medium' : 
                    monitor.ssl_days_until_expiry && monitor.ssl_days_until_expiry <= 30 ? 'text-yellow-600 font-medium' : 
                    'text-green-600'
                  }`}>
                    {monitor.ssl_days_until_expiry !== null 
                      ? `${monitor.ssl_days_until_expiry} days` 
                      : 'Checking...'
                    }
                  </span>
                </div>
                {monitor.ssl_issuer && (
                  <div>
                    <span className="font-medium text-muted-foreground">SSL Issuer:</span>
                    <span className="ml-2">{monitor.ssl_issuer}</span>
                  </div>
                )}
              </>
            )}
            {monitor.domain_enabled && (
              <div>
                <span className="font-medium text-muted-foreground">Domain Expiry:</span>
                <span className={`ml-2 ${
                  monitor.domain_days_until_expiry && monitor.domain_days_until_expiry <= 7 ? 'text-red-600 font-medium' : 
                  monitor.domain_days_until_expiry && monitor.domain_days_until_expiry <= 30 ? 'text-yellow-600 font-medium' : 
                  'text-green-600'
                }`}>
                  {monitor.domain_days_until_expiry !== null 
                    ? `${monitor.domain_days_until_expiry} days` 
                    : 'Checking...'
                  }
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}