import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

interface AlertEmailData {
  monitorName: string
  monitorUrl: string
  alertType: 'down' | 'up'
  timestamp: string
  incident?: {
    id: string
    duration?: number
    cause?: string
  }
}

export async function sendDownAlert({
  recipient,
  monitorName,
  monitorUrl,
  timestamp,
  incident
}: AlertEmailData & { recipient: string }) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'SimpleUptime <alerts@resend.dev>',
      to: [recipient],
      subject: `🔴 ${monitorName} is DOWN`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🔴 Website Down Alert</h1>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #dc2626; margin-top: 0;">${monitorName} is currently down</h2>
            
            <p><strong>Website:</strong> <a href="${monitorUrl}" style="color: #2563eb;">${monitorUrl}</a></p>
            <p><strong>Detected at:</strong> ${new Date(timestamp).toLocaleString()}</p>
            
            ${incident?.cause ? `<p><strong>Cause:</strong> ${incident.cause}</p>` : ''}
            
            <p style="margin-top: 30px; color: #666;">
              We'll notify you when your website comes back online.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; margin: 0;">
              This alert was sent by SimpleUptime. You're receiving this because you're monitoring ${monitorName}.
            </p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send down alert:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Failed to send down alert:', error)
    return { success: false, error }
  }
}

export async function sendUpAlert({
  recipient,
  monitorName,
  monitorUrl,
  timestamp,
  incident
}: AlertEmailData & { recipient: string }) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'SimpleUptime <alerts@resend.dev>',
      to: [recipient],
      subject: `🟢 ${monitorName} is back UP`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #16a34a; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🟢 Website Recovery Alert</h1>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
            <h2 style="color: #16a34a; margin-top: 0;">${monitorName} is back online</h2>
            
            <p><strong>Website:</strong> <a href="${monitorUrl}" style="color: #2563eb;">${monitorUrl}</a></p>
            <p><strong>Recovered at:</strong> ${new Date(timestamp).toLocaleString()}</p>
            
            ${incident?.duration ? `<p><strong>Downtime:</strong> ${formatDuration(incident.duration)} minutes</p>` : ''}
            
            <p style="margin-top: 30px; color: #666;">
              Your website is now responding normally again.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; margin: 0;">
              This alert was sent by SimpleUptime. You're receiving this because you're monitoring ${monitorName}.
            </p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send up alert:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Failed to send up alert:', error)
    return { success: false, error }
  }
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return minutes.toString()
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

// SSL Certificate Alert Interface
interface SSLAlertData {
  recipient: string
  monitorName: string
  monitorUrl: string
  alertType: 'ssl_expiring' | 'ssl_warning' | 'ssl_invalid'
  daysUntilExpiry: number
  issuer: string
  errorMessage?: string | null
}

// Domain Expiration Alert Interface
interface DomainAlertData {
  recipient: string
  monitorName: string
  domain: string
  alertType: 'domain_expiring' | 'domain_invalid'
  daysUntilExpiry: number
  registrar: string
}

export async function sendSSLAlert({
  recipient,
  monitorName,
  monitorUrl,
  alertType,
  daysUntilExpiry,
  issuer,
  errorMessage
}: SSLAlertData) {
  try {
    const isCritical = alertType === 'ssl_expiring' && daysUntilExpiry <= 7
    const subject = isCritical 
      ? `🚨 SSL Certificate EXPIRING in ${daysUntilExpiry} days - ${monitorName}`
      : `⚠️ SSL Certificate Warning - ${monitorName}`

    const { data, error } = await resend.emails.send({
      from: 'SimpleUptime <alerts@resend.dev>',
      to: [recipient],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${isCritical ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">${isCritical ? '🚨' : '⚠️'} SSL Certificate Alert</h1>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
            <h2 style="color: ${isCritical ? '#dc2626' : '#f59e0b'}; margin-top: 0;">
              SSL Certificate ${isCritical ? 'expires soon' : 'needs attention'}
            </h2>
            
            <p><strong>Website:</strong> <a href="${monitorUrl}" style="color: #2563eb;">${monitorUrl}</a></p>
            <p><strong>Monitor:</strong> ${monitorName}</p>
            <p><strong>Days until expiry:</strong> ${daysUntilExpiry}</p>
            <p><strong>Issued by:</strong> ${issuer}</p>
            
            ${errorMessage ? `<p><strong>Issue:</strong> ${errorMessage}</p>` : ''}
            
            <div style="background-color: ${isCritical ? '#fef2f2' : '#fefbf2'}; border-left: 4px solid ${isCritical ? '#dc2626' : '#f59e0b'}; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-weight: bold;">
                ${isCritical 
                  ? 'Action Required: Renew your SSL certificate immediately to avoid website security warnings.'
                  : 'Please plan to renew your SSL certificate soon to avoid service interruption.'
                }
              </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; margin: 0;">
              This alert was sent by SimpleUptime SSL monitoring. You're receiving this because you're monitoring ${monitorName}.
            </p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send SSL alert:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Failed to send SSL alert:', error)
    return { success: false, error }
  }
}

export async function sendDomainAlert({
  recipient,
  monitorName,
  domain,
  alertType,
  daysUntilExpiry,
  registrar
}: DomainAlertData) {
  try {
    const isCritical = daysUntilExpiry <= 7
    const subject = isCritical 
      ? `🚨 Domain EXPIRING in ${daysUntilExpiry} days - ${domain}`
      : `⚠️ Domain expiring soon - ${domain}`

    const { data, error } = await resend.emails.send({
      from: 'SimpleUptime <alerts@resend.dev>',
      to: [recipient],
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: ${isCritical ? '#dc2626' : '#f59e0b'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">${isCritical ? '🚨' : '⚠️'} Domain Expiration Alert</h1>
          </div>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px;">
            <h2 style="color: ${isCritical ? '#dc2626' : '#f59e0b'}; margin-top: 0;">
              Domain ${domain} expires in ${daysUntilExpiry} days
            </h2>
            
            <p><strong>Domain:</strong> ${domain}</p>
            <p><strong>Monitor:</strong> ${monitorName}</p>
            <p><strong>Days until expiry:</strong> ${daysUntilExpiry}</p>
            <p><strong>Registrar:</strong> ${registrar}</p>
            
            <div style="background-color: ${isCritical ? '#fef2f2' : '#fefbf2'}; border-left: 4px solid ${isCritical ? '#dc2626' : '#f59e0b'}; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-weight: bold;">
                ${isCritical 
                  ? 'URGENT: Renew your domain immediately to prevent website downtime and email service interruption.'
                  : 'Please renew your domain soon to avoid service interruption.'
                }
              </p>
            </div>
            
            <p style="margin-top: 30px; color: #666;">
              Contact your registrar (${registrar}) to renew your domain registration.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #999; margin: 0;">
              This alert was sent by SimpleUptime domain monitoring. You're receiving this because you're monitoring ${monitorName}.
            </p>
          </div>
        </div>
      `,
    })

    if (error) {
      console.error('Failed to send domain alert:', error)
      return { success: false, error }
    }

    return { success: true, data }
  } catch (error) {
    console.error('Failed to send domain alert:', error)
    return { success: false, error }
  }
}