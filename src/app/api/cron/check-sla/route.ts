import { NextRequest, NextResponse } from 'next/server'
import { checkAllMonitorsSLA } from '@/lib/sla-notifications'

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret in production
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const providedSecret = request.nextUrl.searchParams.get('secret')
      if (providedSecret !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    console.log('Starting SLA breach check for all monitors...')
    
    const startTime = Date.now()
    await checkAllMonitorsSLA()
    const duration = Date.now() - startTime

    console.log(`SLA breach check completed in ${duration}ms`)

    return NextResponse.json({ 
      success: true, 
      message: 'SLA breach check completed',
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    const { createErrorResponse } = await import('@/lib/error-handler')
    return createErrorResponse(error, 500, 'GET /api/cron/check-sla')
  }
}