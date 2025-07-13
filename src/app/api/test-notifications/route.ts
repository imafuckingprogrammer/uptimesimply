import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendNotifications } from '@/lib/notifications'

// Rate limiting: store last test times per IP/monitor
const testCache = new Map<string, number>()
const RATE_LIMIT_MINUTES = 60 // 1 hour between tests per monitor/IP combination

interface TestNotificationRequest {
  monitorId: string
  channels: {
    email?: boolean
    slack?: boolean
    discord?: boolean
    sms?: boolean
    webhook?: boolean
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TestNotificationRequest = await request.json()
    const { monitorId, channels } = body

    if (!monitorId) {
      return NextResponse.json(
        { error: 'Monitor ID is required' },
        { status: 400 }
      )
    }

    // Get client IP for rate limiting
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown'
    const rateLimitKey = `${ip}-${monitorId}`

    // Check rate limit
    const lastTestTime = testCache.get(rateLimitKey)
    const now = Date.now()
    const timeElapsed = lastTestTime ? now - lastTestTime : Infinity
    const minutesElapsed = timeElapsed / (1000 * 60)

    if (minutesElapsed < RATE_LIMIT_MINUTES) {
      const remainingMinutes = Math.ceil(RATE_LIMIT_MINUTES - minutesElapsed)
      return NextResponse.json(
        { 
          error: `Rate limited. Please wait ${remainingMinutes} minutes before sending another test.`,
          retryAfter: remainingMinutes
        },
        { status: 429 }
      )
    }

    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }

    // Get monitor details
    const { data: monitor, error: monitorError } = await supabaseAdmin
      .from('monitors')
      .select('*')
      .eq('id', monitorId)
      .single()

    if (monitorError || !monitor) {
      return NextResponse.json(
        { error: 'Monitor not found' },
        { status: 404 }
      )
    }

    // Prepare test notification data
    const notificationData = {
      monitorName: monitor.name,
      monitorUrl: monitor.url,
      status: 'test' as const,
      responseTime: 250,
      timestamp: new Date().toISOString(),
      testMode: true
    }

    // Filter monitor channels based on request
    const testMonitor = {
      ...monitor,
      alert_email: channels.email ? monitor.alert_email : null,
      slack_webhook_url: channels.slack ? monitor.slack_webhook_url : null,
      discord_webhook_url: channels.discord ? monitor.discord_webhook_url : null,
      alert_sms: channels.sms ? monitor.alert_sms : null,
      webhook_url: channels.webhook ? monitor.webhook_url : null
    }

    // Send test notifications
    const result = await sendNotifications(testMonitor, notificationData)

    // Update rate limit cache
    testCache.set(rateLimitKey, now)

    // Clean up old cache entries (older than 2 hours)
    Array.from(testCache.entries()).forEach(([key, time]) => {
      if (now - time > 2 * 60 * 60 * 1000) {
        testCache.delete(key)
      }
    })

    return NextResponse.json({
      success: result.success,
      results: result.results,
      message: result.success 
        ? 'Test notifications sent successfully' 
        : 'Some test notifications failed',
      nextTestAvailable: new Date(now + RATE_LIMIT_MINUTES * 60 * 1000).toISOString()
    })

  } catch (error: any) {
    console.error('Error sending test notifications:', error)
    return NextResponse.json(
      { error: 'Failed to send test notifications' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    error: 'Method not allowed. Use POST to send test notifications.'
  }, { status: 405 })
}