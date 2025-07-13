'use client'

import { useState, useEffect } from 'react'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Monitor, UptimeStats } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/StatusIndicator'
import { formatUptime, formatResponseTime, formatDuration } from '@/lib/utils'
import { Trash2, ExternalLink, Clock, TrendingUp, BarChart3, Settings, Shield, Target, Send, Loader2 } from 'lucide-react'

interface MonitorCardProps {
  monitor: Monitor
  stats?: UptimeStats
  onDelete: (id: string) => void
  onEdit?: (id: string) => void
}

export function MonitorCard({ monitor, stats, onDelete, onEdit }: MonitorCardProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [slaData, setSlaData] = useState<any>(null)
  const [slaLoading, setSlaLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this monitor?')) return
    
    setIsDeleting(true)
    try {
      await onDelete(monitor.id)
    } catch (error) {
      console.error('Failed to delete monitor:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleVisit = () => {
    window.open(monitor.url, '_blank', 'noopener,noreferrer')
  }

  const handleViewDetails = () => {
    router.push(`/monitor/${monitor.id}`)
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit(monitor.id)
    }
  }

  const handleViewSSL = () => {
    router.push(`/monitor/${monitor.id}/ssl`)
  }

  const handleSendTest = async () => {
    setSendingTest(true)
    setTestResult(null)
    
    try {
      const response = await fetch('/api/test-notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitorId: monitor.id })
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setTestResult('Test notification sent successfully!')
      } else {
        setTestResult(data.error || 'Failed to send test notification')
      }
    } catch (error) {
      setTestResult('Error sending test notification')
    } finally {
      setSendingTest(false)
      setTimeout(() => setTestResult(null), 5000)
    }
  }

  const fetchQuickSLA = async () => {
    setSlaLoading(true)
    try {
      const response = await fetch(`/api/monitors/${monitor.id}/sla?period=weekly&targets=99.9`)
      if (response.ok) {
        const data = await response.json()
        setSlaData(data)
      }
    } catch (error) {
      console.error('Failed to fetch SLA:', error)
    } finally {
      setSlaLoading(false)
    }
  }

  // Fetch SLA data on mount
  React.useEffect(() => {
    fetchQuickSLA()
  }, [monitor.id])

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <StatusIndicator status={monitor.status} />
              <span className="truncate">{monitor.name}</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {monitor.url}
            </p>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleViewDetails}
              className="h-8 w-8"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleVisit}
              className="h-8 w-8"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEdit}
                className="h-8 w-8"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            {monitor.ssl_enabled && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleViewSSL}
                className="h-8 w-8"
                title="View SSL Details"
              >
                <Shield className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-8 w-8 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        {stats ? (
          <div className="space-y-4">
            {/* Uptime Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-green-600">
                  {formatUptime(stats.uptime_24h)}
                </div>
                <div className="text-xs text-muted-foreground">24h</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-600">
                  {formatUptime(stats.uptime_7d)}
                </div>
                <div className="text-xs text-muted-foreground">7d</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-green-600">
                  {formatUptime(stats.uptime_30d)}
                </div>
                <div className="text-xs text-muted-foreground">30d</div>
              </div>
            </div>

            {/* Additional Stats */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              {stats.avg_response_time > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatResponseTime(stats.avg_response_time)}</span>
                </div>
              )}
              
              {stats.total_incidents > 0 && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>{stats.total_incidents} incidents</span>
                </div>
              )}
            </div>

            {/* Current Incident */}
            {stats.current_incident && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="text-sm font-medium text-red-800">
                  Currently Down
                </div>
                <div className="text-xs text-red-600 mt-1">
                  Started {new Date(stats.current_incident.started_at).toLocaleString()}
                </div>
                {stats.current_incident.cause && (
                  <div className="text-xs text-red-600 mt-1">
                    {stats.current_incident.cause}
                  </div>
                )}
              </div>
            )}

            {/* SSL/Domain Info */}
            {(monitor.ssl_enabled || monitor.domain_enabled) && (
              <div className="space-y-1 pt-2 border-t">
                {monitor.ssl_enabled && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">SSL expires:</span>
                    <div className="flex items-center gap-2">
                      {monitor.ssl_grade && (
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          monitor.ssl_grade.startsWith('A') ? 'bg-green-100 text-green-700' :
                          monitor.ssl_grade.startsWith('B') ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {monitor.ssl_grade}
                        </span>
                      )}
                      <span className={`font-medium ${
                        monitor.ssl_days_until_expiry && monitor.ssl_days_until_expiry <= 7 ? 'text-red-600' : 
                        monitor.ssl_days_until_expiry && monitor.ssl_days_until_expiry <= 30 ? 'text-yellow-600' : 
                        monitor.ssl_days_until_expiry ? 'text-green-600' : 'text-gray-500'
                      }`}>
                        {monitor.ssl_days_until_expiry !== null ? `${monitor.ssl_days_until_expiry} days` : 'Checking...'}
                      </span>
                    </div>
                  </div>
                )}
                {monitor.domain_enabled && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Domain expires:</span>
                    <span className={`font-medium ${
                      (monitor.domain_days_until_expiry || 0) <= 7 ? 'text-red-600' : 
                      (monitor.domain_days_until_expiry || 0) <= 30 ? 'text-yellow-600' : 
                      'text-green-600'
                    }`}>
                      {monitor.domain_days_until_expiry} days
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* SLA Status */}
            {slaData && slaData.calculations && slaData.calculations.length > 0 && (
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    SLA (7d):
                  </span>
                  <Badge 
                    variant={slaData.calculations[0].met ? 'success' : 'destructive'}
                    className="text-xs"
                  >
                    {slaData.calculations[0].met ? 'Met' : 'Breach'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {(slaData.calculations[0].actualUptime * 100).toFixed(2)}% uptime
                </div>
              </div>
            )}

            {/* Test Notification */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Quick Actions:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendTest}
                  disabled={sendingTest}
                  className="h-6 px-2 text-xs"
                >
                  {sendingTest ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3 w-3 mr-1" />
                      Test Alert
                    </>
                  )}
                </Button>
              </div>
              {testResult && (
                <div className={`text-xs mt-1 ${testResult.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult}
                </div>
              )}
            </div>

            {/* Last Checked */}
            {monitor.last_checked && (
              <div className="text-xs text-muted-foreground pt-1">
                Last checked: {new Date(monitor.last_checked).toLocaleString()}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            <div className="text-lg font-semibold mb-2">No data yet</div>
            <div className="text-xs">Monitor needs to be checked first</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}