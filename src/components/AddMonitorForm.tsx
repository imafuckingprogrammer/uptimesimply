'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
// Lazy load heavy components
import dynamic from 'next/dynamic'

const Select = dynamic(() => import('@/components/ui/select').then(mod => ({ default: mod.Select })), { ssr: false })
const SelectContent = dynamic(() => import('@/components/ui/select').then(mod => ({ default: mod.SelectContent })), { ssr: false })
const SelectItem = dynamic(() => import('@/components/ui/select').then(mod => ({ default: mod.SelectItem })), { ssr: false })
const SelectTrigger = dynamic(() => import('@/components/ui/select').then(mod => ({ default: mod.SelectTrigger })), { ssr: false })
const SelectValue = dynamic(() => import('@/components/ui/select').then(mod => ({ default: mod.SelectValue })), { ssr: false })
const Textarea = dynamic(() => import('@/components/ui/textarea').then(mod => ({ default: mod.Textarea })), { ssr: false })
const Tabs = dynamic(() => import('@/components/ui/tabs').then(mod => ({ default: mod.Tabs })), { ssr: false })
const TabsContent = dynamic(() => import('@/components/ui/tabs').then(mod => ({ default: mod.TabsContent })), { ssr: false })
const TabsList = dynamic(() => import('@/components/ui/tabs').then(mod => ({ default: mod.TabsList })), { ssr: false })
const TabsTrigger = dynamic(() => import('@/components/ui/tabs').then(mod => ({ default: mod.TabsTrigger })), { ssr: false })
import { Plus, Globe, Wifi, Settings, Bell } from 'lucide-react'

interface MonitorFormData {
  url: string
  name: string
  alert_email: string
  ssl_enabled: boolean
  domain_enabled: boolean
  // Enhanced features
  monitor_type: 'http' | 'ping' | 'port'
  request_method: string
  request_headers: string
  request_body: string
  auth_type: 'none' | 'basic' | 'bearer' | 'header'
  auth_username: string
  auth_password: string
  auth_token: string
  port_number: string
  notification_channels: string[]
  slack_webhook_url: string
  discord_webhook_url: string
  webhook_url: string
  alert_sms: string
}

interface AddMonitorFormProps {
  onAdd: (data: MonitorFormData) => Promise<void>
}

export function AddMonitorForm({ onAdd }: AddMonitorFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<MonitorFormData>({
    url: '',
    name: '',
    alert_email: 'demo@example.com',
    ssl_enabled: true,
    domain_enabled: false,
    // Enhanced features
    monitor_type: 'http',
    request_method: 'GET',
    request_headers: '',
    request_body: '',
    auth_type: 'none',
    auth_username: '',
    auth_password: '',
    auth_token: '',
    port_number: '',
    notification_channels: ['email'],
    slack_webhook_url: '',
    discord_webhook_url: '',
    webhook_url: '',
    alert_sms: ''
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
        request_body: '',
        auth_type: 'none',
        auth_username: '',
        auth_password: '',
        auth_token: '',
        port_number: '',
        notification_channels: ['email'],
        slack_webhook_url: '',
        discord_webhook_url: '',
        webhook_url: '',
        alert_sms: ''
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
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="text-lg">Add New Monitor</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Basic
              </TabsTrigger>
              <TabsTrigger value="http" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                HTTP Settings
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="advanced" className="flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                Advanced
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-6">
              {/* Monitor Type */}
              <div>
                <label className="text-sm font-medium block mb-2">Monitor Type</label>
                <Select value={formData.monitor_type} onValueChange={(value: 'http' | 'ping' | 'port') => 
                  setFormData(prev => ({ ...prev, monitor_type: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP/HTTPS Website</SelectItem>
                    <SelectItem value="ping">Ping (Server Connectivity)</SelectItem>
                    <SelectItem value="port">Port (Database, Game Server, etc.)</SelectItem>
                  </SelectContent>
                </Select>
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
            </TabsContent>

            <TabsContent value="http" className="space-y-4 mt-6">
              {formData.monitor_type === 'http' ? (
                <>
                  {/* HTTP Method */}
                  <div>
                    <label className="text-sm font-medium block mb-2">HTTP Method</label>
                    <Select value={formData.request_method} onValueChange={(value) => 
                      setFormData(prev => ({ ...prev, request_method: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                        <SelectItem value="HEAD">HEAD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Authentication */}
                  <div>
                    <label className="text-sm font-medium block mb-2">Authentication</label>
                    <Select value={formData.auth_type} onValueChange={(value: 'none' | 'basic' | 'bearer' | 'header') => 
                      setFormData(prev => ({ ...prev, auth_type: value }))
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Authentication</SelectItem>
                        <SelectItem value="basic">Basic Auth (Username/Password)</SelectItem>
                        <SelectItem value="bearer">Bearer Token (JWT, API Key)</SelectItem>
                        <SelectItem value="header">Custom Header (X-API-Key)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Auth Fields */}
                  {formData.auth_type === 'basic' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="auth_username" className="text-sm font-medium block mb-2">
                          Username
                        </label>
                        <Input
                          id="auth_username"
                          type="text"
                          value={formData.auth_username}
                          onChange={(e) => setFormData(prev => ({ ...prev, auth_username: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor="auth_password" className="text-sm font-medium block mb-2">
                          Password
                        </label>
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
                      Custom Headers (JSON)
                    </label>
                    <Textarea
                      id="request_headers"
                      placeholder='{"Content-Type": "application/json", "X-Custom-Header": "value"}'
                      value={formData.request_headers}
                      onChange={(e) => setFormData(prev => ({ ...prev, request_headers: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  {/* Request Body */}
                  {(formData.request_method === 'POST' || formData.request_method === 'PUT' || formData.request_method === 'PATCH') && (
                    <div>
                      <label htmlFor="request_body" className="text-sm font-medium block mb-2">
                        Request Body (JSON)
                      </label>
                      <Textarea
                        id="request_body"
                        placeholder='{"key": "value", "test": true}'
                        value={formData.request_body}
                        onChange={(e) => setFormData(prev => ({ ...prev, request_body: e.target.value }))}
                        rows={4}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  HTTP settings are only available for HTTP/HTTPS monitors
                </div>
              )}
            </TabsContent>

            <TabsContent value="notifications" className="space-y-4 mt-6">
              {/* Email */}
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

              {/* SMS */}
              <div>
                <label htmlFor="alert_sms" className="text-sm font-medium block mb-2">
                  SMS Phone Number (Optional)
                </label>
                <Input
                  id="alert_sms"
                  type="tel"
                  placeholder="+1234567890"
                  value={formData.alert_sms}
                  onChange={(e) => setFormData(prev => ({ ...prev, alert_sms: e.target.value }))}
                />
              </div>

              {/* Slack */}
              <div>
                <label htmlFor="slack_webhook_url" className="text-sm font-medium block mb-2">
                  Slack Webhook URL (Optional)
                </label>
                <Input
                  id="slack_webhook_url"
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={formData.slack_webhook_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, slack_webhook_url: e.target.value }))}
                />
              </div>

              {/* Discord */}
              <div>
                <label htmlFor="discord_webhook_url" className="text-sm font-medium block mb-2">
                  Discord Webhook URL (Optional)
                </label>
                <Input
                  id="discord_webhook_url"
                  type="url"
                  placeholder="https://discord.com/api/webhooks/..."
                  value={formData.discord_webhook_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, discord_webhook_url: e.target.value }))}
                />
              </div>

              {/* Custom Webhook */}
              <div>
                <label htmlFor="webhook_url" className="text-sm font-medium block mb-2">
                  Custom Webhook URL (Optional)
                </label>
                <Input
                  id="webhook_url"
                  type="url"
                  placeholder="https://your-api.com/webhooks/uptime"
                  value={formData.webhook_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, webhook_url: e.target.value }))}
                />
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 mt-6">
              <div className="text-sm text-muted-foreground mb-4">
                Advanced settings for power users and enterprise deployments.
              </div>
              
              <div className="space-y-3">
                <h4 className="font-medium">Notification Channels</h4>
                <div className="text-xs text-muted-foreground mb-2">
                  Automatically configured based on the URLs and settings you provide above.
                </div>
                <div className="bg-gray-50 p-3 rounded text-sm">
                  Active channels: {formData.notification_channels.join(', ')}
                  {formData.slack_webhook_url && !formData.notification_channels.includes('slack') && ', slack'}
                  {formData.discord_webhook_url && !formData.notification_channels.includes('discord') && ', discord'}
                  {formData.alert_sms && !formData.notification_channels.includes('sms') && ', sms'}
                  {formData.webhook_url && !formData.notification_channels.includes('webhook') && ', webhook'}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-6 mt-6 border-t">
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