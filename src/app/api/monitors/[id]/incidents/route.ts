import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const { id } = params

    const { data: incidents, error } = await supabaseAdmin!
      .from('incidents')
      .select('*')
      .eq('monitor_id', id)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json(incidents || [])
  } catch (error) {
    const { createErrorResponse } = await import('@/lib/error-handler')
    return createErrorResponse(error, 500, 'GET /api/monitors/[id]/incidents')
  }
}