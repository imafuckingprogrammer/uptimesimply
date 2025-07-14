'use client'

import { useState, useEffect } from 'react'
import { Monitor, UptimeStats } from '@/types'
import { HeartbeatMonitorCard } from '@/components/HeartbeatMonitorCard'
import { AddHeartbeatMonitorModal } from '@/components/AddHeartbeatMonitorModal'
import { LoadingState } from '@/components/ui/loader'
import { Heart } from 'lucide-react'

interface HeartbeatMonitorFormData {
  name: string
  description: string
  heartbeat_interval: number
  alert_email: string
  slack_webhook_url: string
  discord_webhook_url: string
  alert_sms: string
  webhook_url: string
}

export function HeartbeatDashboard() {
  const [heartbeatMonitors, setHeartbeatMonitors] = useState<Monitor[]>([])
  const [stats, setStats] = useState<Record<string, UptimeStats>>({})
  const [loading, setLoading] = useState(true)

  const fetchHeartbeatMonitors = async () => {
    try {
      const response = await fetch('/api/heartbeat-monitors')
      const data = await response.json()
      setHeartbeatMonitors(Array.isArray(data) ? data : [])
      
      // Fetch stats for each heartbeat monitor
      const monitorArray = Array.isArray(data) ? data : []
      const statsPromises = monitorArray.map(async (monitor: Monitor) => {
        try {
          const statsResponse = await fetch(`/api/monitors/${monitor.id}/stats`)
          const statsData = await statsResponse.json()
          return [monitor.id, statsData]
        } catch (error) {
          console.error(`Failed to fetch stats for monitor ${monitor.id}:`, error)
          return [monitor.id, null]
        }
      })
      
      const statsResults = await Promise.all(statsPromises)
      const statsMap = Object.fromEntries(statsResults.filter(([_, stats]) => stats !== null))
      setStats(statsMap)
    } catch (error) {
      console.error('Failed to fetch heartbeat monitors:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddHeartbeatMonitor = async (data: HeartbeatMonitorFormData) => {
    const response = await fetch('/api/heartbeat-monitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    if (!response.ok) throw new Error('Failed to add heartbeat monitor')
    
    await fetchHeartbeatMonitors()
  }

  const handleDeleteHeartbeatMonitor = async (id: string) => {
    const response = await fetch(`/api/monitors/${id}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) throw new Error('Failed to delete heartbeat monitor')
    
    await fetchHeartbeatMonitors()
  }

  const handleEditHeartbeatMonitor = (id: string) => {
    // For now, just log the edit action
    // In the future, this could open an edit modal
    console.log('Edit heartbeat monitor:', id)
  }

  useEffect(() => {
    fetchHeartbeatMonitors()
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchHeartbeatMonitors, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return <LoadingState size="lg" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-6 w-6 text-pink-500" />
            Heartbeat Monitors
          </h2>
          <p className="text-muted-foreground mt-1">
            Monitor application health with periodic heartbeat signals.
          </p>
        </div>
        <AddHeartbeatMonitorModal onAdd={handleAddHeartbeatMonitor} />
      </div>

      {heartbeatMonitors.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {heartbeatMonitors.map((monitor) => (
            <HeartbeatMonitorCard
              key={monitor.id}
              monitor={monitor}
              stats={stats[monitor.id]}
              onDelete={handleDeleteHeartbeatMonitor}
              onEdit={handleEditHeartbeatMonitor}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
          <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            No heartbeat monitors yet
          </h3>
          <p className="text-muted-foreground mb-4">
            Add your first heartbeat monitor to track application health.
          </p>
          <AddHeartbeatMonitorModal onAdd={handleAddHeartbeatMonitor} />
        </div>
      )}
    </div>
  )
}