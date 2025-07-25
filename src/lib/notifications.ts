// Enhanced notification system supporting multiple channels
import { Monitor } from '@/types'
import { notificationLogger } from './logger'

interface NotificationData {
  monitorName: string
  monitorUrl: string
  status: 'down' | 'up' | 'test' | 'sla_breach'
  responseTime?: number
  statusCode?: number
  errorMessage?: string
  downtime?: string
  testMode?: boolean
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
    const color = data.status === 'down' ? '#ff0000' : 
                  data.status === 'test' ? '#0066cc' : 
                  data.status === 'sla_breach' ? '#ff8c00' : 
                  '#00ff00'
    const emoji = data.status === 'down' ? '🚨' : 
                  data.status === 'test' ? '🧪' : 
                  data.status === 'sla_breach' ? '📊' : 
                  '✅'
    const statusText = data.status === 'down' ? 'DOWN' : 
                       data.status === 'test' ? 'TEST ALERT' : 
                       data.status === 'sla_breach' ? 'SLA BREACH' : 
                       'BACK UP'
    
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
            ] : data.status === 'sla_breach' ? [
              {
                title: 'SLA Breach Details',
                value: data.errorMessage || 'SLA targets not met',
                short: false
              }
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
    const color = data.status === 'down' ? 0xff0000 : 
                  data.status === 'test' ? 0x0066cc : 
                  data.status === 'sla_breach' ? 0xff8c00 : 
                  0x00ff00
    const emoji = data.status === 'down' ? '🚨' : 
                  data.status === 'test' ? '🧪' : 
                  data.status === 'sla_breach' ? '📊' : 
                  '✅'
    const statusText = data.status === 'down' ? 'DOWN' : 
                       data.status === 'test' ? 'TEST ALERT' : 
                       data.status === 'sla_breach' ? 'SLA BREACH' : 
                       'BACK UP'
    
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
        ] : data.status === 'sla_breach' ? [
          {
            name: 'SLA Breach Details',
            value: data.errorMessage || 'SLA targets not met',
            inline: false
          }
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
    const { requireEnvironmentVariables, COMMON_ENV_CONFIGS } = await import('./env-validation')
    requireEnvironmentVariables(COMMON_ENV_CONFIGS.twilio)
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const authToken = process.env.TWILIO_AUTH_TOKEN!
    const fromNumber = process.env.TWILIO_PHONE_NUMBER!

    // Initialize Twilio client
    const twilio = await import('twilio')
    const client = twilio.default(accountSid, authToken)

    const emoji = data.status === 'down' ? '🚨' : 
                  data.status === 'test' ? '🧪' : 
                  data.status === 'sla_breach' ? '📊' : 
                  '✅'
    const statusText = data.status === 'down' ? 'DOWN' : 
                       data.status === 'test' ? 'TEST ALERT' : 
                       data.status === 'sla_breach' ? 'SLA BREACH' : 
                       'BACK UP'
    
    let message = `${emoji} ${data.monitorName} is ${statusText}\n${data.monitorUrl}`
    
    if (data.status === 'down') {
      message += `\nError: ${data.errorMessage || 'Unknown error'}`
      if (data.statusCode) {
        message += `\nStatus: ${data.statusCode}`
      }
    } else if (data.status === 'test') {
      message += `\nThis is a test notification. Response Time: ${data.responseTime || 250}ms`
    } else if (data.status === 'sla_breach') {
      message += `\n${data.errorMessage || 'SLA targets not met'}`
    } else if (data.downtime) {
      message += `\nDowntime: ${data.downtime}`
    }
    
    // Add timestamp and keep message under 160 characters for standard SMS
    message += `\n${new Date().toLocaleTimeString()}`
    
    // Trim message if too long
    if (message.length > 160) {
      message = message.substring(0, 157) + '...'
    }

    // Send SMS using official Twilio SDK
    const result = await client.messages.create({
      body: message,
      from: fromNumber,
      to: phoneNumber,
    })

    return { 
      success: true, 
      deliveryId: result.sid 
    }
  } catch (error: any) {
    console.error('SMS notification failed:', error)
    return { 
      success: false, 
      error: error.message || 'SMS delivery failed'
    }
  }
}

// Custom webhook notification
export async function sendWebhookNotification(
  webhookUrl: string,
  data: NotificationData
): Promise<NotificationResult> {
  try {
    const payload = {
      event: data.status === 'down' ? 'monitor.down' : 
             data.status === 'test' ? 'monitor.test' : 
             data.status === 'sla_breach' ? 'monitor.sla_breach' : 
             'monitor.up',
      timestamp: new Date().toISOString(),
      monitor: {
        name: data.monitorName,
        url: data.monitorUrl,
        status: data.status,
        response_time: data.responseTime,
        status_code: data.statusCode,
        error_message: data.errorMessage,
        downtime_duration: data.downtime,
        test_mode: data.testMode || false
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

// Email notification
export async function sendEmailNotification(
  email: string,
  data: NotificationData
): Promise<NotificationResult> {
  try {
    // Use the email library that's already imported in other files
    const { sendDownAlert, sendUpAlert } = await import('./email')
    
    if (data.status === 'down') {
      await sendDownAlert({
        recipient: email,
        monitorName: data.monitorName,
        monitorUrl: data.monitorUrl,
        alertType: 'down',
        timestamp: new Date().toISOString(),
        incident: {
          id: `incident-${Date.now()}`,
          cause: data.errorMessage || 'Service is down'
        }
      })
    } else if (data.status === 'up') {
      await sendUpAlert({
        recipient: email,
        monitorName: data.monitorName,
        monitorUrl: data.monitorUrl,
        alertType: 'up',
        timestamp: new Date().toISOString(),
        incident: {
          id: `incident-${Date.now()}`,
          duration: data.downtime ? parseInt(data.downtime) : undefined
        }
      })
    } else if (data.status === 'test') {
      // Send a test email
      await sendDownAlert({
        recipient: email,
        monitorName: `[TEST] ${data.monitorName}`,
        monitorUrl: data.monitorUrl,
        alertType: 'down',
        timestamp: new Date().toISOString(),
        incident: {
          id: `test-${Date.now()}`,
          cause: 'This is a test notification from SimpleUptime'
        }
      })
    } else if (data.status === 'sla_breach') {
      await sendDownAlert({
        recipient: email,
        monitorName: `[SLA BREACH] ${data.monitorName}`,
        monitorUrl: data.monitorUrl,
        alertType: 'down',
        timestamp: new Date().toISOString(),
        incident: {
          id: `sla-breach-${Date.now()}`,
          cause: data.errorMessage || 'SLA targets not met'
        }
      })
    }
    
    return { success: true, deliveryId: `email-${Date.now()}` }
  } catch (error: any) {
    const { logError } = await import('./error-handler')
    const standardError = logError(error, 'Email notification')
    return { success: false, error: standardError.message }
  }
}

// Enhanced notification dispatcher with retry logic
async function sendNotificationWithRetry(
  sendFn: () => Promise<NotificationResult>,
  channel: string,
  maxRetries: number = 3
): Promise<NotificationResult> {
  let lastError: any
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendFn()
      if (result.success) {
        if (attempt > 1) {
          notificationLogger.info(`${channel} notification succeeded on attempt ${attempt}`, {
            channel,
            attempt,
            type: 'retry_success'
          })
        }
        return result
      }
      lastError = new Error(result.error || 'Unknown error')
    } catch (error: any) {
      lastError = error
      console.warn(`⚠️ ${channel} notification attempt ${attempt} failed:`, error.message)
    }
    
    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000) // Max 10s
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  console.error(`❌ ${channel} notification failed after ${maxRetries} attempts:`, lastError)
  return { success: false, error: lastError.message }
}

// Main notification dispatcher
export async function sendNotifications(
  monitor: Monitor,
  data: NotificationData
): Promise<{ success: boolean; results: Record<string, NotificationResult> }> {
  const results: Record<string, NotificationResult> = {}
  
  // Check all possible notification channels with retry logic
  const channelPromises: Promise<void>[] = []
  
  // Slack notification
  if (monitor.slack_webhook_url) {
    channelPromises.push(
      sendNotificationWithRetry(
        () => sendSlackNotification(monitor.slack_webhook_url!, data),
        'Slack'
      ).then(result => {
        results.slack = result
      })
    )
  }
  
  // Discord notification  
  if (monitor.discord_webhook_url) {
    channelPromises.push(
      sendNotificationWithRetry(
        () => sendDiscordNotification(monitor.discord_webhook_url!, data),
        'Discord'
      ).then(result => {
        results.discord = result
      })
    )
  }
  
  // SMS notification
  if (monitor.alert_sms) {
    channelPromises.push(
      sendNotificationWithRetry(
        () => sendSMSNotification(monitor.alert_sms!, data),
        'SMS'
      ).then(result => {
        results.sms = result
      })
    )
  }
  
  // Webhook notification
  if (monitor.webhook_url) {
    channelPromises.push(
      sendNotificationWithRetry(
        () => sendWebhookNotification(monitor.webhook_url!, data),
        'Webhook'
      ).then(result => {
        results.webhook = result
      })
    )
  }
  
  // Email notification
  if (monitor.alert_email) {
    channelPromises.push(
      sendNotificationWithRetry(
        () => sendEmailNotification(monitor.alert_email!, data),
        'Email'
      ).then(result => {
        results.email = result
      })
    )
  }
  
  // Wait for all notifications to complete (with error handling)
  await Promise.allSettled(channelPromises.map(async (promise) => {
    try {
      await promise
    } catch (error) {
      console.error('Notification channel error:', error)
    }
  }))
  
  // Check if at least one notification succeeded
  const overallSuccess = Object.values(results).some(result => result.success)
  
  return { success: overallSuccess, results }
}