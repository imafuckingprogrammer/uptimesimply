import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Get SSL check history for the monitor
    const { data: sslChecks, error } = await supabaseAdmin!
      .from('ssl_checks')
      .select('*')
      .eq('monitor_id', id)
      .order('checked_at', { ascending: false })
      .limit(100) // Limit to last 100 checks

    if (error) {
      console.error('Error fetching SSL history:', error)
      return NextResponse.json({ error: 'Failed to fetch SSL history' }, { status: 500 })
    }

    return NextResponse.json(sslChecks || [])
  } catch (error) {
    console.error('Error in SSL history API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}