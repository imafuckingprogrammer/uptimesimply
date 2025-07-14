'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Heart, Plus, ChevronDown, ChevronRight } from 'lucide-react'

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

interface AddHeartbeatMonitorModalProps {
  onAdd: (data: HeartbeatMonitorFormData) => Promise<void>
}

const INTERVAL_OPTIONS = [
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' }
]

export function AddHeartbeatMonitorModal({ onAdd }: AddHeartbeatMonitorModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const [formData, setFormData] = useState<HeartbeatMonitorFormData>({
    name: '',
    description: '',
    heartbeat_interval: 60,
    alert_email: 'demo@example.com',
    slack_webhook_url: '',
    discord_webhook_url: '',
    alert_sms: '',
    webhook_url: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      await onAdd(formData)
      setIsOpen(false)
      // Reset form
      setFormData({
        name: '',
        description: '',
        heartbeat_interval: 60,
        alert_email: 'demo@example.com',
        slack_webhook_url: '',
        discord_webhook_url: '',
        alert_sms: '',
        webhook_url: ''
      })
      setShowAdvanced(false)
    } catch (error) {
      console.error('Failed to add heartbeat monitor:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateField = (field: keyof HeartbeatMonitorFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)} className="gap-2">
        <Heart className="h-4 w-4" />
        Add Heartbeat Monitor
      </Button>

      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Add Heartbeat Monitor">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Monitor Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="My Application Heartbeat"
                required
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Brief description of what this monitors"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="interval">Heartbeat Interval *</Label>
              <Select 
                value={formData.heartbeat_interval.toString()} 
                onValueChange={(value) => updateField('heartbeat_interval', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                How often your application should send heartbeats
              </p>
            </div>

            <div>
              <Label htmlFor="email">Alert Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.alert_email}
                onChange={(e) => updateField('alert_email', e.target.value)}
                placeholder="alerts@example.com"
                required
              />
            </div>
          </div>

          {/* Advanced Notifications */}
          <div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full justify-between p-0 h-auto"
            >
              <span className="font-medium">Additional Notification Channels</span>
              {showAdvanced ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>

            {showAdvanced && (
              <div className="space-y-4 mt-4 pl-4 border-l-2 border-gray-100">
                <div>
                  <Label htmlFor="slack_webhook">Slack Webhook URL</Label>
                  <Input
                    id="slack_webhook"
                    value={formData.slack_webhook_url}
                    onChange={(e) => updateField('slack_webhook_url', e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>

                <div>
                  <Label htmlFor="discord_webhook">Discord Webhook URL</Label>
                  <Input
                    id="discord_webhook"
                    value={formData.discord_webhook_url}
                    onChange={(e) => updateField('discord_webhook_url', e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                  />
                </div>

                <div>
                  <Label htmlFor="sms">SMS Number</Label>
                  <Input
                    id="sms"
                    value={formData.alert_sms}
                    onChange={(e) => updateField('alert_sms', e.target.value)}
                    placeholder="+1234567890"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Requires Twilio configuration
                  </p>
                </div>

                <div>
                  <Label htmlFor="webhook">Custom Webhook URL</Label>
                  <Input
                    id="webhook"
                    value={formData.webhook_url}
                    onChange={(e) => updateField('webhook_url', e.target.value)}
                    placeholder="https://your-app.com/webhooks/alerts"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <h4 className="font-medium text-blue-900 mb-2">How Heartbeat Monitoring Works</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Your application sends a POST request every {formData.heartbeat_interval} seconds</li>
              <li>• If no heartbeat is received within the grace period, an alert is triggered</li>
              <li>• Grace period is 50% of interval (minimum 30 seconds)</li>
              <li>• You'll receive the heartbeat URL after creating the monitor</li>
            </ul>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.name}>
              {isSubmitting ? 'Creating...' : 'Create Heartbeat Monitor'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}