'use client'

import { useState, useEffect } from 'react'
import { Monitor, UptimeStats } from '@/types'
import { MonitorCard } from '@/components/MonitorCard'
import { AddMonitorModal } from '@/components/AddMonitorModal'
import { EditMonitorDialog } from '@/components/EditMonitorDialog'
import { HeartbeatDashboard } from '@/components/HeartbeatDashboard'
import { LoadingState } from '@/components/ui/loader'
import { startDevMonitoring, stopDevMonitoring } from '@/lib/dev-monitor'

export default function Dashboard() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [stats, setStats] = useState<Record<string, UptimeStats>>({})
  const [loading, setLoading] = useState(true)
  const [editingMonitor, setEditingMonitor] = useState<Monitor | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const fetchMonitors = async () => {
    try {
      const response = await fetch('/api/monitors')
      const data = await response.json()
      // Filter out heartbeat monitors since they're displayed separately
      const nonHeartbeatMonitors = Array.isArray(data) 
        ? data.filter((monitor: Monitor) => monitor.monitor_type !== 'heartbeat')
        : []
      setMonitors(nonHeartbeatMonitors)
      
      // Fetch stats for each non-heartbeat monitor
      const statsPromises = nonHeartbeatMonitors.map(async (monitor: Monitor) => {
        const statsResponse = await fetch(`/api/monitors/${monitor.id}/stats`)
        const statsData = await statsResponse.json()
        return [monitor.id, statsData]
      })
      
      const statsResults = await Promise.all(statsPromises)
      const statsMap = Object.fromEntries(statsResults)
      setStats(statsMap)
    } catch (error) {
      console.error('Failed to fetch monitors:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMonitor = async (data: any) => {
    // Automatically configure notification channels based on provided URLs
    const notificationChannels = ['email']
    if (data.slack_webhook_url) notificationChannels.push('slack')
    if (data.discord_webhook_url) notificationChannels.push('discord')
    if (data.alert_sms) notificationChannels.push('sms')
    if (data.webhook_url) notificationChannels.push('webhook')
    
    const monitorData = {
      ...data,
      notification_channels: notificationChannels
    }
    const response = await fetch('/api/monitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(monitorData)
    })
    
    if (!response.ok) throw new Error('Failed to add monitor')
    
    await fetchMonitors()
  }

  const handleDeleteMonitor = async (id: string) => {
    const response = await fetch(`/api/monitors/${id}`, {
      method: 'DELETE'
    })
    
    if (!response.ok) throw new Error('Failed to delete monitor')
    
    await fetchMonitors()
  }

  const handleEditMonitor = (id: string) => {
    const monitor = monitors.find(m => m.id === id)
    if (monitor) {
      setEditingMonitor(monitor)
      setIsEditDialogOpen(true)
    }
  }

  const handleSaveMonitor = async (id: string, data: {
    name: string
    alert_email: string
    ssl_enabled: boolean
    domain_enabled: boolean
    monitor_type: 'http' | 'ping' | 'port'
    request_method: string
    request_headers: string
    auth_type: 'none' | 'basic' | 'bearer' | 'header'
    auth_username: string
    auth_password: string
    auth_token: string
    port_number: string
    slack_webhook_url: string
    discord_webhook_url: string
    alert_sms: string
    webhook_url: string
    notification_channels: string[]
    status_page_public: boolean
  }) => {
    const response = await fetch(`/api/monitors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    
    if (!response.ok) throw new Error('Failed to update monitor')
    
    await fetchMonitors()
  }

  useEffect(() => {
    fetchMonitors()
    
    // Start development monitoring
    startDevMonitoring()
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchMonitors, 30000)
    return () => {
      clearInterval(interval)
      stopDevMonitoring()
    }
  }, [])

  if (loading) {
    return <LoadingState size="lg" fullScreen />
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Monitor your websites and applications with instant alerts.
          </p>
        </div>
        <AddMonitorModal onAdd={handleAddMonitor} />
      </div>

      {/* Website Monitors */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Website Monitors</h2>
          <p className="text-muted-foreground mt-1">
            HTTP/HTTPS, ping, and port monitoring for your websites and services.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {monitors.map((monitor) => (
            <MonitorCard
              key={monitor.id}
              monitor={monitor}
              stats={stats[monitor.id]}
              onDelete={handleDeleteMonitor}
              onEdit={handleEditMonitor}
            />
          ))}
        </div>

        {monitors.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              No website monitors yet
            </h3>
            <p className="text-muted-foreground mb-4">
              Add your first website to start monitoring uptime.
            </p>
            <AddMonitorModal onAdd={handleAddMonitor} />
          </div>
        )}
      </div>

      {/* Heartbeat Monitors */}
      <HeartbeatDashboard />

      <EditMonitorDialog
        monitor={editingMonitor}
        isOpen={isEditDialogOpen}
        onClose={() => {
          setIsEditDialogOpen(false)
          setEditingMonitor(null)
        }}
        onSave={handleSaveMonitor}
      />
    </div>
  )
}
