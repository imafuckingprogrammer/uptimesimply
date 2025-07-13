import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }

    // Test if enhanced columns already exist
    const { data: testData, error: testError } = await supabaseAdmin
      .from('monitors')
      .select('id, monitor_type, auth_type, notification_channels')
      .limit(1)
    
    if (!testError) {
      return NextResponse.json({ 
        success: true, 
        message: 'Enhanced columns already exist!',
        sample: testData 
      })
    }
    
    // If columns don't exist, we need to run the migration manually
    // For now, let's just report what needs to be done
    return NextResponse.json({ 
      success: false, 
      message: 'Enhanced columns missing. Please run the database migration manually.',
      error: testError.message,
      instructions: 'Apply database-enhanced-monitoring-safe.sql to your Supabase database'
    })
    
  } catch (error: any) {
    console.error('Migration test error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}