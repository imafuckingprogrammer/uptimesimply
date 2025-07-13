import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const incidentId = searchParams.get('incident_id')
    
    if (!incidentId) {
      return NextResponse.json({ error: 'incident_id is required' }, { status: 400 })
    }

    // Get incident diagnostics with incident and monitor details
    const { data: diagnostics, error } = await supabaseAdmin!
      .from('incident_diagnostics')
      .select(`
        *,
        incidents!inner (
          id,
          started_at,
          ended_at,
          duration_minutes,
          cause,
          resolved
        ),
        monitors!inner (
          id,
          name,
          url
        )
      `)
      .eq('incident_id', incidentId)
      .eq('monitor_id', id)
      .order('captured_at', { ascending: false })

    if (error) {
      console.error('Error fetching incident diagnostics:', error)
      return NextResponse.json({ error: 'Failed to fetch diagnostics' }, { status: 500 })
    }

    // Group diagnostics by location for easier display
    const diagnosticsByLocation = diagnostics?.reduce((acc, diagnostic) => {
      const location = diagnostic.location
      if (!acc[location]) {
        acc[location] = []
      }
      acc[location].push(diagnostic)
      return acc
    }, {} as Record<string, any[]>) || {}

    return NextResponse.json({
      incident: diagnostics?.[0]?.incidents,
      monitor: diagnostics?.[0]?.monitors,
      diagnostics: diagnosticsByLocation,
      total_diagnostics: diagnostics?.length || 0
    })
  } catch (error) {
    console.error('Error fetching incident diagnostics:', error)
    return NextResponse.json({ error: 'Failed to fetch diagnostics' }, { status: 500 })
  }
}