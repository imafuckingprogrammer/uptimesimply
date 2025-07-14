import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d'
    const mode = searchParams.get('mode') || 'days'
    const monitorId = params.id

    // Calculate the date range based on period
    const now = new Date()
    let startDate: Date
    let intervalMinutes: number

    switch (period) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        intervalMinutes = 60 // 1 hour intervals for 1 day
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        intervalMinutes = 24 * 60 // 1 day intervals for 7 days
        break
      case '14d':
        startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
        intervalMinutes = 24 * 60 // 1 day intervals for 14 days
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        intervalMinutes = 24 * 60 // 1 day intervals for 30 days
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        intervalMinutes = 24 * 60
    }

    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 500 }
      )
    }

    // Fetch monitoring checks for the specified period
    const { data: checks, error: checksError } = await supabaseAdmin
      .from('uptime_checks')
      .select('status, response_time, checked_at')
      .eq('monitor_id', monitorId)
      .gte('checked_at', startDate.toISOString())
      .order('checked_at', { ascending: true })

    if (checksError) {
      console.error('Error fetching monitoring checks:', checksError)
      return NextResponse.json(
        { error: 'Failed to fetch monitoring data' },
        { status: 500 }
      )
    }

    // Fetch incidents for the specified period
    const { data: incidents, error: incidentsError } = await supabaseAdmin
      .from('incidents')
      .select('started_at, ended_at')
      .eq('monitor_id', monitorId)
      .gte('started_at', startDate.toISOString())
      .order('started_at', { ascending: true })

    if (incidentsError) {
      console.error('Error fetching incidents:', incidentsError)
      return NextResponse.json(
        { error: 'Failed to fetch incidents data' },
        { status: 500 }
      )
    }

    // Generate time intervals
    const intervals: Array<{
      timestamp: string
      responseTime: number
      uptime: number
      incidents: number
      avgResponseTime: number
    }> = []

    const intervalMs = intervalMinutes * 60 * 1000
    let currentTime = new Date(startDate)

    while (currentTime <= now) {
      const intervalEnd = new Date(currentTime.getTime() + intervalMs)
      
      // Filter checks for this interval
      const intervalChecks = checks?.filter(check => {
        const checkTime = new Date(check.checked_at)
        return checkTime >= currentTime && checkTime < intervalEnd
      }) || []

      // Filter incidents for this interval
      const intervalIncidents = incidents?.filter(incident => {
        const incidentTime = new Date(incident.started_at)
        return incidentTime >= currentTime && incidentTime < intervalEnd
      }) || []

      // Calculate metrics for this interval
      let responseTime = 0
      let uptime = 0
      let avgResponseTime = 0

      if (intervalChecks.length > 0) {
        const upCount = intervalChecks.filter(check => check.status === 'up').length
        const responseTimes = intervalChecks
          .filter(check => check.response_time && check.response_time > 0)
          .map(check => check.response_time)

        uptime = (upCount / intervalChecks.length) * 100
        responseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0
        avgResponseTime = responseTimes.length > 0 
          ? responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length 
          : 0
      }

      intervals.push({
        timestamp: currentTime.toISOString(),
        responseTime: Math.round(responseTime),
        uptime: Math.round(uptime * 10) / 10, // Round to 1 decimal place
        incidents: intervalIncidents.length,
        avgResponseTime: Math.round(avgResponseTime)
      })

      currentTime = new Date(intervalEnd)
    }

    return NextResponse.json({
      data: intervals,
      period,
      mode,
      totalDataPoints: intervals.length
    })

  } catch (error: any) {
    console.error('Error in performance trends API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}