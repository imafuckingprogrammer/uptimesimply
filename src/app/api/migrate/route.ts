import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }

    // Try to fix the URL constraint for heartbeat monitoring
    try {
      // First, drop the existing constraint
      await supabaseAdmin.rpc('execute_sql', {
        sql: 'ALTER TABLE monitors DROP CONSTRAINT IF EXISTS check_url_format;'
      })
      
      // Then add the new constraint that supports heartbeat URLs
      await supabaseAdmin.rpc('execute_sql', {
        sql: `ALTER TABLE monitors ADD CONSTRAINT check_url_format 
              CHECK (url ~ '^(https?|heartbeat)://');`
      })
      
      // Update any existing heartbeat monitors
      await supabaseAdmin.rpc('execute_sql', {
        sql: `UPDATE monitors 
              SET url = 'heartbeat://monitor-' || id::text
              WHERE monitor_type = 'heartbeat' 
                AND url NOT LIKE 'heartbeat://%';`
      })
      
      return NextResponse.json({ 
        success: true, 
        message: 'URL constraint updated to support heartbeat:// URLs'
      })
      
    } catch (constraintError: any) {
      // If RPC doesn't work, fall back to testing columns
      console.log('RPC approach failed, testing columns instead:', constraintError)
    }

    // Test if enhanced columns already exist
    const { data: testData, error: testError } = await supabaseAdmin
      .from('monitors')
      .select('id, monitor_type, auth_type, notification_channels')
      .limit(1)
    
    if (!testError) {
      return NextResponse.json({ 
        success: true, 
        message: 'Enhanced columns already exist! You may need to manually run the heartbeat URL constraint fix.',
        sample: testData,
        instructions: 'If heartbeat monitors fail, run: ALTER TABLE monitors DROP CONSTRAINT check_url_format; ALTER TABLE monitors ADD CONSTRAINT check_url_format CHECK (url ~ \'^(https?|heartbeat)://\');'
      })
    }
    
    // If columns don't exist, we need to run the migration manually
    return NextResponse.json({ 
      success: false, 
      message: 'Enhanced columns missing. Please run the database migration manually.',
      error: testError.message,
      instructions: 'Apply database-enhanced-monitoring-safe.sql AND database-heartbeat-url-fix.sql to your Supabase database'
    })
    
  } catch (error: any) {
    console.error('Migration test error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}