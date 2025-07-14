'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Monitor, UptimeStats } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/StatusIndicator'
import { formatUptime, formatDuration } from '@/lib/utils'
import { Trash2, Heart, Clock, Copy, Code2, Settings, Activity } from 'lucide-react'

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
            <p className="text-sm text-muted-foreground mt-1">
              Heartbeat Monitor • Expected every {monitor.heartbeat_interval || 60}s
            </p>
          </div>
          <div className="flex items-center gap-1 ml-4">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="h-8 w-8 p-0"
              >
                <Settings className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleViewDetails}
              className="h-8 w-8 p-0"
            >
              <Activity className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Status and Last Heartbeat */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <div className="flex items-center gap-2 mt-1">
                <StatusIndicator status={monitor.status} size="sm" />
                <span className="text-sm font-medium capitalize">{monitor.status}</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Last Heartbeat</p>
              <p className={`text-sm font-medium mt-1 ${lastHeartbeatStatus.color}`}>
                {lastHeartbeatStatus.text}
              </p>
            </div>
          </div>

          {/* Uptime Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">24h Uptime</p>
                <p className="text-lg font-bold text-green-600">
                  {stats.uptime_24h !== null ? formatUptime(stats.uptime_24h) : '-%'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">7d Uptime</p>
                <p className="text-lg font-bold text-green-600">
                  {stats.uptime_7d !== null ? formatUptime(stats.uptime_7d) : '-%'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Incidents</p>
                <p className="text-lg font-bold">
                  {stats.total_incidents || 0}
                </p>
              </div>
            </div>
          )}

          {/* Heartbeat Instructions */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Heartbeat Instructions</h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInstructions(!showInstructions)}
                className="h-6 text-xs"
              >
                {showInstructions ? 'Hide' : 'Show'}
              </Button>
            </div>
            
            {showInstructions && (
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <span className="font-medium">Heartbeat URL:</span>
                  <div className="flex items-center gap-1 mt-1">
                    <code className="bg-muted px-2 py-1 rounded text-xs flex-1 break-all">
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
                  <span className="font-medium">HTTP Method:</span>
                  <code className="bg-muted px-2 py-1 rounded text-xs ml-2">POST</code>
                </div>
                
                <div>
                  <span className="font-medium">cURL Example:</span>
                  <div className="flex items-center gap-1 mt-1">
                    <code className="bg-muted px-2 py-1 rounded text-xs flex-1 break-all">
                      {`curl -X POST ${getHeartbeatUrl()} -H "Content-Type: application/json" -d '{"status": "up"}'`}
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
                
                <div>
                  <span className="font-medium">Request Body (JSON):</span>
                  <div className="flex items-center gap-1 mt-1">
                    <code className="bg-muted px-2 py-1 rounded text-xs flex-1">
                      {`{"status": "up", "message": "optional", "response_time": 100}`}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(`{"status": "up", "message": "optional", "response_time": 100}`)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}