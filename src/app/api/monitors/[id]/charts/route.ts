import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    const hours = searchParams.get('hours') // New parameter for today view
    const { id } = params

    let startDate = new Date()
    
    if (hours) {
      // Today view - show last X hours
      startDate.setHours(startDate.getHours() - parseInt(hours))
    } else {
      // Daily view - show last X days  
      startDate.setDate(startDate.getDate() - days)
      // Set to start of day for consistent daily grouping
      startDate.setHours(0, 0, 0, 0)
    }

    console.log(`Fetching chart data for monitor ${id}, period: ${hours ? hours + 'h' : days + 'd'}, startDate: ${startDate.toISOString()}`)

    // Get uptime checks grouped by day
    const { data: checks, error } = await supabaseAdmin!
      .from('uptime_checks')
      .select('checked_at, status, response_time')
      .eq('monitor_id', id)
      .gte('checked_at', startDate.toISOString())
      .order('checked_at', { ascending: true })

    if (error) throw error

    console.log(`Found ${checks?.length || 0} checks for monitor ${id}`)
    
    // If we have no data, return empty array
    if (!checks || checks.length === 0) {
      console.log(`No data found for monitor ${id}`)
      return NextResponse.json([])
    }
    
    // Group checks by date or hour
    const timeStats = new Map<string, { upCount: number; totalCount: number; responseTimes: number[] }>()
    
    checks?.forEach(check => {
      const checkDate = new Date(check.checked_at)
      let timeKey: string
      
      if (hours) {
        // Group by hour for today view
        timeKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}T${String(checkDate.getHours()).padStart(2, '0')}`
      } else {
        // Group by day for multi-day view using local timezone
        timeKey = checkDate.toISOString().split('T')[0]
      }
      
      if (!timeStats.has(timeKey)) {
        timeStats.set(timeKey, { upCount: 0, totalCount: 0, responseTimes: [] })
      }
      
      const stats = timeStats.get(timeKey)!
      stats.totalCount++
      
      if (check.status === 'up') {
        stats.upCount++
        if (check.response_time) {
          stats.responseTimes.push(check.response_time)
        }
      }
    })

    // Convert to chart data and sort by timeKey
    const sortedEntries = Array.from(timeStats.entries()).sort(([a], [b]) => {
      return new Date(a).getTime() - new Date(b).getTime()
    })

    const chartData = sortedEntries.map(([timeKey, stats]) => {
      const uptime = stats.totalCount > 0 ? (stats.upCount / stats.totalCount) * 100 : 0
      const avgResponseTime = stats.responseTimes.length > 0 
        ? stats.responseTimes.reduce((sum, time) => sum + time, 0) / stats.responseTimes.length
        : 0

      let displayLabel: string
      if (hours) {
        // For hourly view, show hour (e.g., "2 PM", "3 PM")
        const date = new Date(timeKey + ':00:00')
        displayLabel = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
      } else {
        // For daily view, show date (e.g., "Jul 12")
        displayLabel = new Date(timeKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }

      return {
        date: displayLabel,
        uptime: Math.round(uptime * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime),
        timeKey // Keep for debugging
      }
    })

    console.log(`Returning ${chartData.length} data points for monitor ${id}:`, chartData.map(d => `${d.date}: ${d.uptime}% (${d.timeKey})`))
    
    // For multi-day periods, if we only have one data point, it means the monitor was created recently
    // Let's pad with previous days showing "No data" or extend the single day data
    if (!hours && chartData.length === 1 && days > 1) {
      console.log(`Only one data point for ${days}d period, monitor likely created recently`)
    }

    return NextResponse.json(chartData)
  } catch (error) {
    console.error('Error fetching chart data:', error)
    return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 })
  }
}