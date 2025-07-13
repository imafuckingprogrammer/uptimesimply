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

    // Fetch monitoring checks with response times for the specified period
    const { data: checks, error } = await supabase
      .from('uptime_checks')
      .select('response_time')
      .eq('monitor_id', monitorId)
      .gte('checked_at', startDate.toISOString())
      .not('response_time', 'is', null)
      .gt('response_time', 0)
      .order('response_time', { ascending: true })

    if (error) {
      console.error('Error fetching monitoring checks:', error)
      return NextResponse.json(
        { error: 'Failed to fetch monitoring data' },
        { status: 500 }
      )
    }

    if (!checks || checks.length === 0) {
      return NextResponse.json({
        distribution: [],
        stats: {
          total: 0,
          average: 0,
          median: 0,
          p95: 0,
          p99: 0
        }
      })
    }

    const responseTimes = checks.map(check => check.response_time).sort((a, b) => a - b)

    // Calculate statistics
    const total = responseTimes.length
    const average = responseTimes.reduce((sum, rt) => sum + rt, 0) / total
    const median = responseTimes[Math.floor(total / 2)]
    const p95 = responseTimes[Math.floor(total * 0.95)]
    const p99 = responseTimes[Math.floor(total * 0.99)]

    // Create distribution bins
    const maxResponseTime = Math.max(...responseTimes)
    const minResponseTime = Math.min(...responseTimes)
    
    // Define custom bins based on typical response time ranges
    const bins = [
      { min: 0, max: 100, label: '0-100ms', range: '0-100ms' },
      { min: 100, max: 200, label: '100-200ms', range: '100-200ms' },
      { min: 200, max: 500, label: '200-500ms', range: '200-500ms' },
      { min: 500, max: 1000, label: '500ms-1s', range: '500ms-1s' },
      { min: 1000, max: 2000, label: '1-2s', range: '1-2s' },
      { min: 2000, max: 5000, label: '2-5s', range: '2-5s' },
      { min: 5000, max: 10000, label: '5-10s', range: '5-10s' },
      { min: 10000, max: Infinity, label: '10s+', range: '10s+' }
    ]

    // Count responses in each bin
    const distribution = bins.map(bin => {
      const count = responseTimes.filter(rt => rt >= bin.min && rt < bin.max).length
      const percentage = total > 0 ? (count / total) * 100 : 0
      
      // Assign colors based on performance ranges
      let color = '#16a34a' // Green for fast
      if (bin.min >= 500) color = '#f59e0b' // Yellow for medium
      if (bin.min >= 2000) color = '#dc2626' // Red for slow

      return {
        range: bin.range,
        count,
        percentage,
        label: bin.label,
        color
      }
    }).filter(bin => bin.count > 0) // Only include bins with data

    // If no standard bins have data, create dynamic bins
    if (distribution.length === 0 && responseTimes.length > 0) {
      const binCount = Math.min(8, Math.max(3, Math.ceil(Math.sqrt(responseTimes.length))))
      const binSize = (maxResponseTime - minResponseTime) / binCount
      
      for (let i = 0; i < binCount; i++) {
        const binMin = minResponseTime + (i * binSize)
        const binMax = i === binCount - 1 ? maxResponseTime + 1 : minResponseTime + ((i + 1) * binSize)
        
        const count = responseTimes.filter(rt => rt >= binMin && rt < binMax).length
        const percentage = (count / total) * 100
        
        if (count > 0) {
          distribution.push({
            range: `${Math.round(binMin)}-${Math.round(binMax)}ms`,
            count,
            percentage,
            label: `${Math.round(binMin)}-${Math.round(binMax)}ms`,
            color: binMin < 500 ? '#16a34a' : binMin < 2000 ? '#f59e0b' : '#dc2626'
          })
        }
      }
    }

    return NextResponse.json({
      distribution,
      stats: {
        total,
        average,
        median,
        p95,
        p99
      },
      period
    })

  } catch (error: any) {
    console.error('Error in response distribution API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}