import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const { id } = params
    const now = new Date()
    const day24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Get uptime checks for different time periods
    const { data: checks24h } = await supabaseAdmin!
      .from('uptime_checks')
      .select('status, response_time, checked_at')
      .eq('monitor_id', id)
      .gte('checked_at', day24Ago.toISOString())

    const { data: checks7d } = await supabaseAdmin!
      .from('uptime_checks')
      .select('status, checked_at')
      .eq('monitor_id', id)
      .gte('checked_at', days7Ago.toISOString())

    const { data: checks30d } = await supabaseAdmin!
      .from('uptime_checks')
      .select('status, checked_at')
      .eq('monitor_id', id)
      .gte('checked_at', days30Ago.toISOString())

    // Get current incident
    const { data: currentIncident } = await supabaseAdmin!
      .from('incidents')
      .select('*')
      .eq('monitor_id', id)
      .eq('resolved', false)
      .order('started_at', { ascending: false })
      .limit(1)

    // Get total incidents count
    const { count: totalIncidents } = await supabaseAdmin!
      .from('incidents')
      .select('*', { count: 'exact', head: true })
      .eq('monitor_id', id)

    // Calculate uptime percentages with sufficient data check
    const calculateUptime = (checks: any[], minRequiredHours: number) => {
      if (!checks || checks.length === 0) return null
      
      // Check if we have sufficient data coverage for the period
      const checkTimes = checks.map(c => new Date(c.checked_at).getTime())
      const oldestCheck = Math.min(...checkTimes)
      const newestCheck = Math.max(...checkTimes)
      const hoursOfData = (newestCheck - oldestCheck) / (1000 * 60 * 60)
      
      // Need sufficient time coverage AND minimum number of checks
      if (hoursOfData < minRequiredHours || checks.length < 3) return null
      
      const upChecks = checks.filter(check => check.status === 'up').length
      return (upChecks / checks.length) * 100
    }

    // Calculate average response time
    const validResponseTimes = checks24h?.filter(check => 
      check.response_time && check.status === 'up'
    ).map(check => check.response_time) || []
    
    const avgResponseTime = validResponseTimes.length > 0 
      ? validResponseTimes.reduce((sum, time) => sum + time, 0) / validResponseTimes.length
      : 0

    const stats = {
      uptime_24h: calculateUptime(checks24h || [], 12), // Need 12+ hours of data
      uptime_7d: calculateUptime(checks7d || [], 72),   // Need 3+ days of data  
      uptime_30d: calculateUptime(checks30d || [], 168), // Need 7+ days of data
      avg_response_time: Math.round(avgResponseTime),
      total_incidents: totalIncidents || 0,
      current_incident: currentIncident?.[0] || null
    }

    return NextResponse.json(stats)
  } catch (error) {
    const { createErrorResponse } = await import('@/lib/error-handler')
    return createErrorResponse(error, 500, 'GET /api/monitors/[id]/stats')
  }
}