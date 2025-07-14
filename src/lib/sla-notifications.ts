// SLA breach notification system
import { Monitor } from '@/types'
import { SLACalculation, SLA_TARGETS, calculateMultipleSLAs, detectSLABreaches, getDateRangeForPeriod, formatSLAPercentage, formatDowntime } from '@/lib/sla'
import { sendNotifications } from '@/lib/notifications'
import { supabaseAdmin } from '@/lib/supabase'

interface SLABreachNotificationData {
  monitorName: string
  monitorUrl: string
  breachedCalculations: SLACalculation[]
  period: string
  timestamp: string
}

/**
 * Check for SLA breaches and send notifications
 */
export async function checkAndNotifySLABreaches(monitor: Monitor): Promise<void> {
  try {
    // Get recent uptime checks for the monitor
    const { startDate, endDate } = getDateRangeForPeriod('monthly')
    
    const { data: checks, error } = await supabaseAdmin
      .from('uptime_checks')
      .select('status, checked_at, response_time, location')
      .eq('monitor_id', monitor.id)
      .gte('checked_at', startDate.toISOString())
      .lte('checked_at', endDate.toISOString())
      .order('checked_at', { ascending: true })

    if (error || !checks || checks.length === 0) {
      console.log(`No checks found for monitor ${monitor.id} in SLA calculation`)
      return
    }

    // Calculate SLA for multiple targets
    const slaCalculations = calculateMultipleSLAs(
      checks.map(check => ({
        status: check.status,
        checked_at: check.checked_at,
        response_time: check.response_time
      })),
      SLA_TARGETS,
      'monthly',
      startDate,
      endDate
    )

    // Detect breaches
    const breaches = detectSLABreaches(slaCalculations)
    
    if (breaches.length === 0) {
      return // No breaches to report
    }

    // Check if we've already notified about these breaches recently
    const shouldNotify = await shouldSendSLANotification(monitor.id, breaches)
    
    if (!shouldNotify) {
      return
    }

    // Send SLA breach notifications
    await sendSLABreachNotifications(monitor, breaches)
    
    // Log the notification
    await logSLANotification(monitor.id, breaches)
    
  } catch (error) {
    console.error(`Failed to check SLA breaches for monitor ${monitor.id}:`, error)
  }
}

/**
 * Send SLA breach notifications via all configured channels
 */
async function sendSLABreachNotifications(monitor: Monitor, breaches: SLACalculation[]): Promise<void> {
  const notificationData = {
    monitorName: monitor.name,
    monitorUrl: monitor.url,
    status: 'sla_breach' as const,
    responseTime: undefined,
    statusCode: undefined,
    errorMessage: formatSLABreachMessage(breaches),
    downtime: undefined,
    testMode: false
  }

  try {
    const result = await sendNotifications(monitor, notificationData)
    
    if (result.success) {
      console.log(`SLA breach notifications sent for monitor ${monitor.id}`)
    } else {
      console.error(`Failed to send SLA breach notifications for monitor ${monitor.id}:`, result.results)
    }
  } catch (error) {
    console.error(`Error sending SLA breach notifications for monitor ${monitor.id}:`, error)
  }
}

/**
 * Format SLA breach message for notifications
 */
function formatSLABreachMessage(breaches: SLACalculation[]): string {
  if (breaches.length === 1) {
    const breach = breaches[0]
    return `SLA breach detected: ${formatSLAPercentage(breach.actualUptime)} uptime (target: ${formatSLAPercentage(breach.targetUptime)}). Budget exceeded by ${formatDowntime(Math.abs(breach.remainingBudget))}.`
  } else {
    const worstBreach = breaches.reduce((worst, current) => 
      current.actualUptime < worst.actualUptime ? current : worst
    )
    return `Multiple SLA breaches detected. Worst: ${formatSLAPercentage(worstBreach.actualUptime)} uptime (target: ${formatSLAPercentage(worstBreach.targetUptime)}). ${breaches.length} targets affected.`
  }
}

/**
 * Check if we should send SLA notification (avoid spam)
 */
async function shouldSendSLANotification(monitorId: string, breaches: SLACalculation[]): Promise<boolean> {
  try {
    // Check if we've sent an SLA notification in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    
    const { data: recentNotifications, error } = await supabaseAdmin
      .from('sla_notifications') // Assuming this table exists
      .select('id')
      .eq('monitor_id', monitorId)
      .gte('sent_at', oneDayAgo.toISOString())
      .limit(1)

    if (error) {
      console.warn(`Error checking recent SLA notifications for monitor ${monitorId}:`, error)
      return true // Send notification if we can't check
    }

    return recentNotifications.length === 0
  } catch (error) {
    console.warn(`Error checking SLA notification history for monitor ${monitorId}:`, error)
    return true // Send notification if we can't check
  }
}

/**
 * Log SLA notification to prevent spam
 */
async function logSLANotification(monitorId: string, breaches: SLACalculation[]): Promise<void> {
  try {
    const logEntry = {
      monitor_id: monitorId,
      breach_count: breaches.length,
      worst_uptime: Math.min(...breaches.map(b => b.actualUptime)),
      breach_details: JSON.stringify(breaches.map(b => ({
        target: b.targetUptime,
        actual: b.actualUptime,
        shortfall: b.targetUptime - b.actualUptime
      }))),
      sent_at: new Date().toISOString()
    }

    // Try to insert into sla_notifications table
    // If table doesn't exist, we'll just log to console
    try {
      await supabaseAdmin
        .from('sla_notifications')
        .insert(logEntry)
    } catch (tableError) {
      console.log(`SLA notification logged (table not found): Monitor ${monitorId}, ${breaches.length} breaches`)
    }
  } catch (error) {
    console.warn(`Failed to log SLA notification for monitor ${monitorId}:`, error)
  }
}

/**
 * Periodic SLA check for all monitors
 */
export async function checkAllMonitorsSLA(): Promise<void> {
  try {
    const { data: monitors, error } = await supabaseAdmin
      .from('monitors')
      .select('*')
      .eq('status', 'up') // Only check active monitors
      .limit(100)

    if (error || !monitors) {
      console.error('Failed to fetch monitors for SLA check:', error)
      return
    }

    console.log(`Checking SLA for ${monitors.length} monitors`)

    // Check SLA for each monitor in parallel (with concurrency limit)
    const batchSize = 5
    for (let i = 0; i < monitors.length; i += batchSize) {
      const batch = monitors.slice(i, i + batchSize)
      await Promise.all(batch.map(monitor => checkAndNotifySLABreaches(monitor)))
      
      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < monitors.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    console.log('SLA check completed for all monitors')
  } catch (error) {
    console.error('Failed to check SLA for all monitors:', error)
  }
}