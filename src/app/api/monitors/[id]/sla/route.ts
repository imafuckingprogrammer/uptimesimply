import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { 
  calculateMultipleSLAs, 
  SLA_TARGETS, 
  generateSLAReport,
  getDateRangeForPeriod,
  TIME_PERIODS
} from '@/lib/sla'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') as keyof typeof TIME_PERIODS || 'monthly'
    const targets = searchParams.get('targets')?.split(',').map(Number) || [99.9, 99.99]
    const monitorId = params.id

    // Get monitor details
    const { data: monitor, error: monitorError } = await supabaseAdmin
      .from('monitors')
      .select('id, name, url')
      .eq('id', monitorId)
      .single()

    if (monitorError || !monitor) {
      return NextResponse.json(
        { error: 'Monitor not found' },
        { status: 404 }
      )
    }

    // Get date range for the period
    const { startDate, endDate } = getDateRangeForPeriod(period)

    // Fetch uptime checks for the period
    const { data: checks, error: checksError } = await supabaseAdmin
      .from('uptime_checks')
      .select('status, checked_at, response_time')
      .eq('monitor_id', monitorId)
      .gte('checked_at', startDate.toISOString())
      .lte('checked_at', endDate.toISOString())
      .order('checked_at', { ascending: true })

    if (checksError) {
      console.error('Error fetching uptime checks:', checksError)
      return NextResponse.json(
        { error: 'Failed to fetch monitoring data' },
        { status: 500 }
      )
    }

    // Filter SLA targets based on request
    const selectedTargets = SLA_TARGETS.filter(target => 
      targets.includes(target.percentage)
    )

    if (selectedTargets.length === 0) {
      return NextResponse.json(
        { error: 'No valid SLA targets specified' },
        { status: 400 }
      )
    }

    // Calculate SLA compliance
    const calculations = calculateMultipleSLAs(
      checks || [],
      selectedTargets,
      period,
      startDate,
      endDate
    )

    // Generate comprehensive report
    const report = generateSLAReport(monitorId, monitor.name, calculations)

    // Add additional metadata
    const response = {
      ...report,
      metadata: {
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalChecks: checks?.length || 0,
        monitorUrl: monitor.url,
        calculatedAt: new Date().toISOString()
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    const { createErrorResponse } = await import('@/lib/error-handler')
    return createErrorResponse(error, 500, 'GET /api/monitors/[id]/sla')
  }
}

// POST endpoint for custom SLA calculations
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }

    const body = await request.json()
    const { 
      startDate, 
      endDate, 
      targets = [99.9, 99.99],
      period = 'monthly' 
    } = body

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const monitorId = params.id
    const start = new Date(startDate)
    const end = new Date(endDate)

    // Validate date range
    if (start >= end) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      )
    }

    // Get monitor details
    const { data: monitor, error: monitorError } = await supabaseAdmin
      .from('monitors')
      .select('id, name, url')
      .eq('id', monitorId)
      .single()

    if (monitorError || !monitor) {
      return NextResponse.json(
        { error: 'Monitor not found' },
        { status: 404 }
      )
    }

    // Fetch uptime checks for the custom period
    const { data: checks, error: checksError } = await supabaseAdmin
      .from('uptime_checks')
      .select('status, checked_at, response_time')
      .eq('monitor_id', monitorId)
      .gte('checked_at', start.toISOString())
      .lte('checked_at', end.toISOString())
      .order('checked_at', { ascending: true })

    if (checksError) {
      console.error('Error fetching uptime checks:', checksError)
      return NextResponse.json(
        { error: 'Failed to fetch monitoring data' },
        { status: 500 }
      )
    }

    // Filter SLA targets
    const selectedTargets = SLA_TARGETS.filter(target => 
      targets.includes(target.percentage)
    )

    // Calculate SLA compliance for custom period
    const calculations = calculateMultipleSLAs(
      checks || [],
      selectedTargets,
      period as keyof typeof TIME_PERIODS,
      start,
      end
    )

    // Generate report
    const report = generateSLAReport(monitorId, monitor.name, calculations)

    const response = {
      ...report,
      metadata: {
        customPeriod: true,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalChecks: checks?.length || 0,
        monitorUrl: monitor.url,
        calculatedAt: new Date().toISOString()
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    const { createErrorResponse } = await import('@/lib/error-handler')
    return createErrorResponse(error, 500, 'POST /api/monitors/[id]/sla')
  }
}