import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }

    const monitorId = params.id
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '1')

    // Get the most recent check from each location
    const { data: locations, error } = await supabaseAdmin
      .from('uptime_checks')
      .select('location, status, response_time, status_code, error_message, checked_at')
      .eq('monitor_id', monitorId)
      .order('checked_at', { ascending: false })
      .limit(limit * 5) // Get enough records to have recent data from all locations

    if (error) {
      console.error('Error fetching location data:', error)
      return NextResponse.json(
        { error: 'Failed to fetch location data' },
        { status: 500 }
      )
    }

    // Group by location and get the most recent check for each
    const locationMap = new Map()
    
    for (const check of locations || []) {
      if (!locationMap.has(check.location)) {
        locationMap.set(check.location, check)
      }
    }

    const recentLocations = Array.from(locationMap.values())

    // Calculate summary statistics
    const upLocations = recentLocations.filter(l => l.status === 'up').length
    const downLocations = recentLocations.filter(l => l.status === 'down' || l.status === 'error' || l.status === 'timeout').length
    const avgResponseTime = recentLocations
      .filter(l => l.status === 'up' && l.response_time)
      .reduce((sum, l) => sum + (l.response_time || 0), 0) / Math.max(1, recentLocations.filter(l => l.status === 'up' && l.response_time).length)

    return NextResponse.json({
      locations: recentLocations.map(location => ({
        location: location.location,
        status: location.status,
        response_time: location.response_time,
        status_code: location.status_code,
        error_message: location.error_message,
        checked_at: location.checked_at
      })),
      summary: {
        total_locations: recentLocations.length,
        up_locations: upLocations,
        down_locations: downLocations,
        avg_response_time: isNaN(avgResponseTime) ? null : Math.round(avgResponseTime)
      }
    })

  } catch (error: any) {
    console.error('Error in locations API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch location data' },
      { status: 500 }
    )
  }
}