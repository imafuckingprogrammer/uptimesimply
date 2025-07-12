// Enhanced notification system supporting multiple channels
import { Monitor } from '@/types'

interface NotificationData {
  monitorName: string
  monitorUrl: string
  status: 'down' | 'up'
  responseTime?: number
  statusCode?: number
  errorMessage?: string
  downtime?: string
}

interface NotificationResult {
  success: boolean
  error?: string
  deliveryId?: string
}

// Slack webhook notification
export async function sendSlackNotification(
  webhookUrl: string,
  data: NotificationData
): Promise<NotificationResult> {
  try {
    const color = data.status === 'down' ? '#ff0000' : '#00ff00'
    const emoji = data.status === 'down' ? '🚨' : '✅'
    const statusText = data.status === 'down' ? 'DOWN' : 'BACK UP'
    
    const payload = {
      attachments: [
        {
          color,
          title: `${emoji} ${data.monitorName} is ${statusText}`,
          title_link: data.monitorUrl,
          fields: [
            {
              title: 'Monitor',
              value: data.monitorName,
              short: true
            },
            {
              title: 'URL',
              value: data.monitorUrl,
              short: true
            },
            ...(data.status === 'down' ? [
              {
                title: 'Error',
                value: data.errorMessage || 'Unknown error',
                short: false
              },
              ...(data.statusCode ? [{
                title: 'Status Code',
                value: data.statusCode.toString(),
                short: true
              }] : [])
            ] : [
              {
                title: 'Response Time',
                value: `${data.responseTime}ms`,
                short: true
              },
              ...(data.downtime ? [{
                title: 'Downtime Duration',
                value: data.downtime,
                short: true
              }] : [])
            ])
          ],
          footer: 'SimpleUptime',
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.status}`)
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Discord webhook notification
export async function sendDiscordNotification(
  webhookUrl: string,
  data: NotificationData
): Promise<NotificationResult> {
  try {
    const color = data.status === 'down' ? 0xff0000 : 0x00ff00
    const emoji = data.status === 'down' ? '🚨' : '✅'
    const statusText = data.status === 'down' ? 'DOWN' : 'BACK UP'
    
    const embed = {
      title: `${emoji} ${data.monitorName} is ${statusText}`,
      url: data.monitorUrl,
      color,
      fields: [
        {
          name: 'Monitor',
          value: data.monitorName,
          inline: true
        },
        {
          name: 'URL',
          value: data.monitorUrl,
          inline: true
        },
        ...(data.status === 'down' ? [
          {
            name: 'Error',
            value: data.errorMessage || 'Unknown error',
            inline: false
          },
          ...(data.statusCode ? [{
            name: 'Status Code',
            value: data.statusCode.toString(),
            inline: true
          }] : [])
        ] : [
          {
            name: 'Response Time',
            value: `${data.responseTime}ms`,
            inline: true
          },
          ...(data.downtime ? [{
            name: 'Downtime Duration',
            value: data.downtime,
            inline: true
          }] : [])
        ])
      ],
      footer: {
        text: 'SimpleUptime'
      },
      timestamp: new Date().toISOString()
    }

    const payload = { embeds: [embed] }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`)
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// SMS notification via Twilio
export async function sendSMSNotification(
  phoneNumber: string,
  data: NotificationData
): Promise<NotificationResult> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio credentials not configured')
    }

    const emoji = data.status === 'down' ? '🚨' : '✅'
    const statusText = data.status === 'down' ? 'DOWN' : 'BACK UP'
    
    let message = `${emoji} ${data.monitorName} is ${statusText}\\n${data.monitorUrl}`
    
    if (data.status === 'down') {
      message += `\\nError: ${data.errorMessage || 'Unknown error'}`
      if (data.statusCode) {
        message += `\\nStatus: ${data.statusCode}`
      }
    } else if (data.downtime) {
      message += `\\nDowntime: ${data.downtime}`
    }

    // Twilio API call
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: phoneNumber,
        Body: message,
      }),
    })

    if (!response.ok) {
      throw new Error(`Twilio API error: ${response.status}`)
    }

    const result = await response.json()
    return { success: true, deliveryId: result.sid }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Custom webhook notification
export async function sendWebhookNotification(
  webhookUrl: string,
  data: NotificationData
): Promise<NotificationResult> {
  try {
    const payload = {
      event: data.status === 'down' ? 'monitor.down' : 'monitor.up',
      timestamp: new Date().toISOString(),
      monitor: {
        name: data.monitorName,
        url: data.monitorUrl,
        status: data.status,
        response_time: data.responseTime,
        status_code: data.statusCode,
        error_message: data.errorMessage,
        downtime_duration: data.downtime
      }
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'SimpleUptime/1.0 Webhook',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Webhook error: ${response.status}`)
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Main notification dispatcher
export async function sendNotifications(
  monitor: Monitor,
  data: NotificationData
): Promise<{ success: boolean; results: Record<string, NotificationResult> }> {
  const results: Record<string, NotificationResult> = {}
  const channels = monitor.notification_channels || ['email']
  
  // Send notifications to all configured channels
  const promises = channels.map(async (channel) => {
    switch (channel) {
      case 'slack':
        if (monitor.slack_webhook_url) {
          results.slack = await sendSlackNotification(monitor.slack_webhook_url, data)
        }
        break
        
      case 'discord':
        if (monitor.discord_webhook_url) {
          results.discord = await sendDiscordNotification(monitor.discord_webhook_url, data)
        }
        break
        
      case 'sms':
        if (monitor.alert_sms) {
          results.sms = await sendSMSNotification(monitor.alert_sms, data)
        }
        break
        
      case 'webhook':
        if (monitor.webhook_url) {
          results.webhook = await sendWebhookNotification(monitor.webhook_url, data)
        }
        break
        
      case 'email':
        // Email is handled by existing email system
        results.email = { success: true }
        break
    }
  })
  
  await Promise.all(promises)
  
  // Check if at least one notification succeeded
  const overallSuccess = Object.values(results).some(result => result.success)
  
  return { success: overallSuccess, results }
}