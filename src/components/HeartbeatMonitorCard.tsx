'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Monitor, UptimeStats } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/StatusIndicator'
import { formatUptime, formatDuration } from '@/lib/utils'
import { Trash2, Heart, Clock, Copy, Code2, Settings, BarChart3 } from 'lucide-react'

interface HeartbeatMonitorCardProps {
  monitor: Monitor
  stats?: UptimeStats
  onDelete: (id: string) => void
  onEdit?: (id: string) => void
}

export function HeartbeatMonitorCard({ monitor, stats, onDelete, onEdit }: HeartbeatMonitorCardProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this heartbeat monitor?')) return
    
    setIsDeleting(true)
    try {
      await onDelete(monitor.id)
    } catch (error) {
      console.error('Failed to delete monitor:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit(monitor.id)
    }
  }

  const handleViewDetails = () => {
    router.push(`/monitor/${monitor.id}`)
  }

  const getHeartbeatUrl = () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    return `${baseUrl}/api/monitors/${monitor.id}/heartbeat`
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const getLastHeartbeatStatus = () => {
    if (!monitor.last_heartbeat) {
      return { text: 'Never received', color: 'text-red-600' }
    }

    const lastHeartbeat = new Date(monitor.last_heartbeat)
    const now = new Date()
    const secondsAgo = Math.floor((now.getTime() - lastHeartbeat.getTime()) / 1000)
    const expectedInterval = monitor.heartbeat_interval || 60
    const gracePeriod = Math.max(30, expectedInterval * 0.5)

    if (secondsAgo <= expectedInterval + gracePeriod) {
      return { 
        text: `${formatDuration(secondsAgo)} ago`, 
        color: 'text-green-600' 
      }
    } else {
      return { 
        text: `${formatDuration(secondsAgo)} ago (overdue)`, 
        color: 'text-red-600' 
      }
    }
  }

  const lastHeartbeatStatus = getLastHeartbeatStatus()

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <StatusIndicator status={monitor.status} />
              <Heart className="h-4 w-4 text-pink-500" />
              <span className="truncate">{monitor.name}</span>
            </CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                Heartbeat Monitor
              </Badge>
              <span className="text-xs text-muted-foreground">
                Every {monitor.heartbeat_interval || 60}s
              </span>
            </div>
            {monitor.description && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {monitor.description}
              </p>
            )}
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
              onClick={() => setShowInstructions(!showInstructions)}
              className="h-8 w-8"
            >
              <Code2 className="h-4 w-4" />
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

            {/* Last Heartbeat */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span className="text-muted-foreground">Last heartbeat:</span>
              </div>
              <span className={`font-medium ${lastHeartbeatStatus.color}`}>
                {lastHeartbeatStatus.text}
              </span>
            </div>

            {/* Current Incident */}
            {stats.current_incident && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <div className="text-sm font-medium text-red-800">
                  Missing Heartbeats
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
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            <div className="text-lg font-semibold mb-2">Waiting for first heartbeat</div>
            <div className="text-xs">Configure your service to send heartbeats</div>
          </div>
        )}

        {/* Integration Instructions */}
        {showInstructions && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md border">
            <div className="text-sm font-medium mb-2">Integration Instructions</div>
            
            <div className="space-y-2 text-xs">
              <div>
                <span className="font-medium">Heartbeat URL:</span>
                <div className="flex items-center gap-1 mt-1">
                  <code className="bg-white px-2 py-1 rounded text-xs flex-1 break-all">
                    {getHeartbeatUrl()}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(getHeartbeatUrl())}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div>
                <span className="font-medium">cURL Example:</span>
                <div className="flex items-center gap-1 mt-1">
                  <code className="bg-white px-2 py-1 rounded text-xs flex-1 break-all">
                    curl -X POST {getHeartbeatUrl()} -H "Content-Type: application/json" -d '{"status": "up"}'
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(`curl -X POST ${getHeartbeatUrl()} -H "Content-Type: application/json" -d '{"status": "up"}'`)}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                Send a POST request every {monitor.heartbeat_interval || 60} seconds with status "up". 
                If no heartbeat is received within the grace period, an incident will be created.
              </div>
            </div>
          </div>
        )}

        {/* Last Checked */}
        {monitor.last_checked && (
          <div className="text-xs text-muted-foreground mt-4">
            Last checked: {new Date(monitor.last_checked).toLocaleString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}