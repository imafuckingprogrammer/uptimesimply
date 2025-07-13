import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d'
    const monitorId = params.id

    // Calculate the date range based on period
    const now = new Date()
    let startDate: Date

    switch (period) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '14d':
        startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    // Fetch monitoring checks for the specified period
    const { data: checks, error } = await supabase
      .from('uptime_checks')
      .select('status, response_time, checked_at')
      .eq('monitor_id', monitorId)
      .gte('checked_at', startDate.toISOString())
      .order('checked_at', { ascending: false })

    if (error) {
      console.error('Error fetching monitoring checks:', error)
      return NextResponse.json(
        { error: 'Failed to fetch monitoring data' },
        { status: 500 }
      )
    }

    if (!checks || checks.length === 0) {
      return NextResponse.json({
        online: 0,
        offline: 0,
        degraded: 0,
        onlinePercentage: 0,
        offlinePercentage: 0,
        degradedPercentage: 0,
        totalChecks: 0
      })
    }

    // Count status occurrences
    const statusCounts = {
      online: 0,
      offline: 0,
      degraded: 0
    }

    checks.forEach(check => {
      // Determine status based on response
      if (check.status === 'up') {
        // Further categorize based on response time
        if (check.response_time && check.response_time > 5000) {
          // Consider slow responses as degraded
          statusCounts.degraded++
        } else {
          statusCounts.online++
        }
      } else {
        statusCounts.offline++
      }
    })

    const totalChecks = checks.length
    
    // Calculate percentages
    const onlinePercentage = totalChecks > 0 ? (statusCounts.online / totalChecks) * 100 : 0
    const offlinePercentage = totalChecks > 0 ? (statusCounts.offline / totalChecks) * 100 : 0
    const degradedPercentage = totalChecks > 0 ? (statusCounts.degraded / totalChecks) * 100 : 0

    return NextResponse.json({
      online: statusCounts.online,
      offline: statusCounts.offline,
      degraded: statusCounts.degraded,
      onlinePercentage,
      offlinePercentage,
      degradedPercentage,
      totalChecks
    })

  } catch (error: any) {
    console.error('Error in status distribution API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}