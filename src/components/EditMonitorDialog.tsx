'use client'

import { useState, useEffect } from 'react'
import { Monitor } from '@/types'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronRight, Send, Loader2 } from 'lucide-react'

interface EditMonitorDialogProps {
  monitor: Monitor | null
  isOpen: boolean
  onClose: () => void
  onSave: (id: string, data: {
    name: string
    alert_email: string
    ssl_enabled: boolean
    domain_enabled: boolean
    monitor_type: 'http' | 'ping' | 'port' | 'heartbeat'
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
  }) => Promise<void>
}

export function EditMonitorDialog({ monitor, isOpen, onClose, onSave }: EditMonitorDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    alert_email: '',
    ssl_enabled: true,
    domain_enabled: true,
    monitor_type: 'http' as 'http' | 'ping' | 'port' | 'heartbeat',
    request_method: 'GET',
    request_headers: '',
    auth_type: 'none' as 'none' | 'basic' | 'bearer' | 'header',
    auth_username: '',
    auth_password: '',
    auth_token: '',
    port_number: '',
    slack_webhook_url: '',
    discord_webhook_url: '',
    alert_sms: '',
    webhook_url: '',
    notification_channels: ['email'] as string[],
    status_page_public: true
  })

  useEffect(() => {
    if (monitor) {
      setFormData({
        name: monitor.name,
        alert_email: monitor.alert_email || '',
        ssl_enabled: monitor.ssl_enabled !== false,
        domain_enabled: monitor.domain_enabled !== false,
        monitor_type: (monitor.monitor_type || 'http') as 'http' | 'ping' | 'port' | 'heartbeat',
        request_method: monitor.request_method || 'GET',
        request_headers: monitor.request_headers || '',
        auth_type: monitor.auth_type || 'none',
        auth_username: monitor.auth_username || '',
        auth_password: monitor.auth_password || '',
        auth_token: monitor.auth_token || '',
        port_number: monitor.port_number?.toString() || '',
        slack_webhook_url: monitor.slack_webhook_url || '',
        discord_webhook_url: monitor.discord_webhook_url || '',
        alert_sms: monitor.alert_sms || '',
        webhook_url: monitor.webhook_url || '',
        notification_channels: monitor.notification_channels || ['email'],
        status_page_public: monitor.status_page_public !== false
      })
    }
  }, [monitor])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!monitor || !formData.name) return

    setIsSubmitting(true)
    try {
      await onSave(monitor.id, formData)
      onClose()
    } catch (error) {
      console.error('Failed to update monitor:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSendTestAlert = async () => {
    if (!monitor) return

    setIsSendingTest(true)
    setTestResult(null)

    try {
      // Determine which channels to test based on current form data
      const channels = {
        email: !!formData.alert_email,
        slack: !!formData.slack_webhook_url,
        discord: !!formData.discord_webhook_url,
        sms: !!formData.alert_sms,
        webhook: !!formData.webhook_url
      }

      const response = await fetch('/api/test-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          monitorId: monitor.id,
          channels
        }),
      })

      const result = await response.json()

      if (response.ok) {
        setTestResult({
          success: true,
          message: result.message || 'Test notifications sent successfully!'
        })
      } else {
        setTestResult({
          success: false,
          message: result.error || 'Failed to send test notifications'
        })
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Network error occurred while sending test notifications'
      })
    } finally {
      setIsSendingTest(false)
    }
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Edit Monitor"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* Monitor Type */}
        <div>
          <label className="text-sm font-medium block mb-2">Monitor Type</label>
          <select 
            value={formData.monitor_type} 
            onChange={(e) => setFormData(prev => ({ ...prev, monitor_type: e.target.value as any }))}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled
          >
            <option value="http">HTTP/HTTPS Website</option>
            <option value="ping">Ping (Server Connectivity)</option>
            <option value="port">Port (Database, Game Server, etc.)</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">Monitor type cannot be changed after creation</p>
        </div>

        {/* URL */}
        <div>
          <label className="text-sm font-medium block mb-2">
            {formData.monitor_type === 'http' ? 'Website URL' : 
             formData.monitor_type === 'ping' ? 'Hostname or IP' : 
             'Host Address'} (read-only)
          </label>
          <Input
            type="url"
            value={monitor?.url || ''}
            disabled
            className="bg-muted"
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
        
        <div>
          <label htmlFor="edit-name" className="text-sm font-medium block mb-2">
            Display Name
          </label>
          <Input
            id="edit-name"
            type="text"
            placeholder="My Website"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>
        
        <div>
          <label htmlFor="edit-email" className="text-sm font-medium block mb-2">
            Alert Email
          </label>
          <Input
            id="edit-email"
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
                id="edit-ssl"
                type="checkbox"
                checked={formData.ssl_enabled}
                onChange={(e) => setFormData(prev => ({ ...prev, ssl_enabled: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <label htmlFor="edit-ssl" className="text-sm font-medium">
                Monitor SSL Certificate
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                id="edit-domain"
                type="checkbox"
                checked={formData.domain_enabled}
                onChange={(e) => setFormData(prev => ({ ...prev, domain_enabled: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <label htmlFor="edit-domain" className="text-sm font-medium">
                Monitor Domain Expiration
              </label>
            </div>
          </div>
        )}

        {/* Status Page Visibility */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <input
              id="edit-status-page-public"
              type="checkbox"
              checked={formData.status_page_public}
              onChange={(e) => setFormData(prev => ({ ...prev, status_page_public: e.target.checked }))}
              className="rounded border-gray-300"
            />
            <label htmlFor="edit-status-page-public" className="text-sm font-medium">
              Public Status Page
            </label>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            When enabled, anyone with the link can view your status page at /status/{monitor?.id}
          </p>
        </div>

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
          <div className="space-y-4 pt-4 border-t bg-muted/30 -mx-6 px-6 pb-4">
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
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Additional Notifications (Optional)</h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSendTestAlert}
                  disabled={isSendingTest || !monitor}
                  className="flex items-center gap-2"
                >
                  {isSendingTest ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  {isSendingTest ? 'Sending...' : 'Send Test Alert'}
                </Button>
              </div>

              {/* Test Result */}
              {testResult && (
                <div className={`p-3 rounded-md text-sm ${
                  testResult.success 
                    ? 'bg-green-50 text-green-800 border border-green-200' 
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                  {testResult.message}
                </div>
              )}
              
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

              <div>
                <label htmlFor="webhook_url" className="text-sm font-medium block mb-2">Custom Webhook URL</label>
                <Input
                  id="webhook_url"
                  type="url"
                  placeholder="https://your-api.com/webhook"
                  value={formData.webhook_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, webhook_url: e.target.value }))}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                ⏰ Test alerts are rate-limited to 1 per hour per monitor to prevent spam.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  )
}