// DEPRECATED: This component is not used anywhere in the application
// The app uses AddMonitorModal instead. This file can be safely deleted.

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, ChevronDown, ChevronRight } from 'lucide-react'

interface MonitorFormData {
  url: string
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
}

interface AddMonitorFormProps {
  onAdd: (data: MonitorFormData) => Promise<void>
}

export function SimpleAddMonitorForm({ onAdd }: AddMonitorFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const [formData, setFormData] = useState<MonitorFormData>({
    url: '',
    name: '',
    alert_email: 'demo@example.com',
    ssl_enabled: true,
    domain_enabled: false,
    monitor_type: 'http',
    request_method: 'GET',
    request_headers: '',
    auth_type: 'none',
    auth_username: '',
    auth_password: '',
    auth_token: '',
    port_number: '',
    slack_webhook_url: '',
    discord_webhook_url: '',
    alert_sms: '',
    webhook_url: '',
    notification_channels: ['email']
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.url || !formData.name) return

    setIsSubmitting(true)
    try {
      await onAdd(formData)
      setFormData({
        url: '',
        name: '',
        alert_email: 'demo@example.com',
        ssl_enabled: true,
        domain_enabled: false,
        monitor_type: 'http',
        request_method: 'GET',
        request_headers: '',
        auth_type: 'none',
        auth_username: '',
        auth_password: '',
        auth_token: '',
        port_number: '',
        slack_webhook_url: '',
        discord_webhook_url: '',
        alert_sms: '',
        webhook_url: '',
        notification_channels: ['email']
      })
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to add monitor:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value
    setFormData(prev => ({ 
      ...prev, 
      url,
      name: prev.name || extractNameFromUrl(url)
    }))
  }

  const extractNameFromUrl = (url: string): string => {
    try {
      const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
      return domain.replace('www.', '')
    } catch {
      return ''
    }
  }

  if (!isOpen) {
    return (
      <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
        <CardContent className="flex items-center justify-center py-8">
          <Button onClick={() => setIsOpen(true)} variant="ghost" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add New Monitor
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">Add New Monitor</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Monitor Type */}
          <div>
            <label className="text-sm font-medium block mb-2">Monitor Type</label>
            <select 
              value={formData.monitor_type} 
              onChange={(e) => setFormData(prev => ({ ...prev, monitor_type: e.target.value as any }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="http">HTTP/HTTPS Website</option>
              <option value="ping">Ping (Server Connectivity)</option>
              <option value="port">Port (Database, Game Server, etc.)</option>
            </select>
          </div>

          {/* URL */}
          <div>
            <label htmlFor="url" className="text-sm font-medium block mb-2">
              {formData.monitor_type === 'http' ? 'Website URL' : 
               formData.monitor_type === 'ping' ? 'Hostname or IP' : 
               'Host Address'}
            </label>
            <Input
              id="url"
              type="text"
              placeholder={
                formData.monitor_type === 'http' ? 'https://example.com' :
                formData.monitor_type === 'ping' ? 'example.com or 192.168.1.1' :
                'database.example.com'
              }
              value={formData.url}
              onChange={handleUrlChange}
              required
              autoFocus
            />
          </div>

          {/* Port Number for Port Monitoring */}
          {formData.monitor_type === 'port' && (
            <div>
              <label htmlFor="port_number" className="text-sm font-medium block mb-2">
                Port Number
              </label>
              <Input
                id="port_number"
                type="number"
                placeholder="3306, 5432, 27017, etc."
                value={formData.port_number}
                onChange={(e) => setFormData(prev => ({ ...prev, port_number: e.target.value }))}
                required
              />
            </div>
          )}
          
          {/* Display Name */}
          <div>
            <label htmlFor="name" className="text-sm font-medium block mb-2">
              Display Name
            </label>
            <Input
              id="name"
              type="text"
              placeholder="My Website"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          
          {/* Alert Email */}
          <div>
            <label htmlFor="alert_email" className="text-sm font-medium block mb-2">
              Alert Email
            </label>
            <Input
              id="alert_email"
              type="email"
              value={formData.alert_email}
              onChange={(e) => setFormData(prev => ({ ...prev, alert_email: e.target.value }))}
              required
            />
          </div>

          {/* SSL/Domain Options (only for HTTP) */}
          {formData.monitor_type === 'http' && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  id="ssl_enabled"
                  type="checkbox"
                  checked={formData.ssl_enabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, ssl_enabled: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="ssl_enabled" className="text-sm font-medium">
                  Monitor SSL Certificate (Recommended)
                </label>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  id="domain_enabled"
                  type="checkbox"
                  checked={formData.domain_enabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, domain_enabled: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="domain_enabled" className="text-sm font-medium">
                  Monitor Domain Expiration
                </label>
              </div>
            </div>
          )}

          {/* Advanced Options Toggle */}
          <div className="pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-sm"
            >
              {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Advanced Settings (Auth, Notifications, etc.)
            </Button>
          </div>

          {/* Advanced Settings */}
          {showAdvanced && (
            <div className="space-y-4 pt-4 border-t bg-gray-50 -mx-6 px-6 pb-4">
              {/* Authentication (HTTP only) */}
              {formData.monitor_type === 'http' && (
                <>
                  <div>
                    <label className="text-sm font-medium block mb-2">Authentication</label>
                    <select 
                      value={formData.auth_type} 
                      onChange={(e) => setFormData(prev => ({ ...prev, auth_type: e.target.value as any }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="none">No Authentication</option>
                      <option value="basic">Basic Auth (Username/Password)</option>
                      <option value="bearer">Bearer Token (JWT, API Key)</option>
                      <option value="header">Custom Header (X-API-Key)</option>
                    </select>
                  </div>

                  {/* Auth Fields */}
                  {formData.auth_type === 'basic' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="auth_username" className="text-sm font-medium block mb-2">Username</label>
                        <Input
                          id="auth_username"
                          type="text"
                          value={formData.auth_username}
                          onChange={(e) => setFormData(prev => ({ ...prev, auth_username: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor="auth_password" className="text-sm font-medium block mb-2">Password</label>
                        <Input
                          id="auth_password"
                          type="password"
                          value={formData.auth_password}
                          onChange={(e) => setFormData(prev => ({ ...prev, auth_password: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}

                  {(formData.auth_type === 'bearer' || formData.auth_type === 'header') && (
                    <div>
                      <label htmlFor="auth_token" className="text-sm font-medium block mb-2">
                        {formData.auth_type === 'bearer' ? 'Bearer Token' : 'API Key'}
                      </label>
                      <Input
                        id="auth_token"
                        type="password"
                        placeholder={formData.auth_type === 'bearer' ? 'eyJhbGciOiJIUzI1NiIs...' : 'sk_test_1234567890'}
                        value={formData.auth_token}
                        onChange={(e) => setFormData(prev => ({ ...prev, auth_token: e.target.value }))}
                      />
                    </div>
                  )}

                  {/* Custom Headers */}
                  <div>
                    <label htmlFor="request_headers" className="text-sm font-medium block mb-2">
                      Custom Headers (JSON) - Optional
                    </label>
                    <textarea
                      id="request_headers"
                      placeholder='{"Content-Type": "application/json", "X-Custom-Header": "value"}'
                      value={formData.request_headers}
                      onChange={(e) => setFormData(prev => ({ ...prev, request_headers: e.target.value }))}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </>
              )}

              {/* Notifications */}
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Additional Notifications (Optional)</h4>
                
                <div>
                  <label htmlFor="slack_webhook_url" className="text-sm font-medium block mb-2">Slack Webhook URL</label>
                  <Input
                    id="slack_webhook_url"
                    type="url"
                    placeholder="https://hooks.slack.com/services/..."
                    value={formData.slack_webhook_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, slack_webhook_url: e.target.value }))}
                  />
                </div>

                <div>
                  <label htmlFor="discord_webhook_url" className="text-sm font-medium block mb-2">Discord Webhook URL</label>
                  <Input
                    id="discord_webhook_url"
                    type="url"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={formData.discord_webhook_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, discord_webhook_url: e.target.value }))}
                  />
                </div>

                <div>
                  <label htmlFor="alert_sms" className="text-sm font-medium block mb-2">SMS Phone Number</label>
                  <Input
                    id="alert_sms"
                    type="tel"
                    placeholder="+1234567890"
                    value={formData.alert_sms}
                    onChange={(e) => setFormData(prev => ({ ...prev, alert_sms: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Monitor'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}