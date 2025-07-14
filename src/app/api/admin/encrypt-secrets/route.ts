import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { encryptMonitorSecrets, decryptMonitorSecrets } from '@/lib/encryption'

export async function POST(request: NextRequest) {
  try {
    // Security check - only allow in development or with admin key
    const adminKey = request.headers.get('x-admin-key')
    if (process.env.NODE_ENV === 'production' && adminKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }

    const { action } = await request.json()
    
    if (action !== 'encrypt' && action !== 'decrypt') {
      return NextResponse.json({ error: 'Invalid action. Must be "encrypt" or "decrypt"' }, { status: 400 })
    }

    // Get all monitors
    const { data: monitors, error: fetchError } = await supabaseAdmin
      .from('monitors')
      .select('*')

    if (fetchError) throw fetchError

    const results = {
      processed: 0,
      errors: [] as string[],
      skipped: 0
    }

    for (const monitor of monitors || []) {
      try {
        let processedMonitor
        let shouldUpdate = false

        if (action === 'encrypt') {
          // Skip if already encrypted
          if (monitor.secrets_encrypted) {
            results.skipped++
            continue
          }
          
          processedMonitor = encryptMonitorSecrets(monitor)
          processedMonitor.secrets_encrypted = true
          shouldUpdate = true
        } else {
          // Skip if not encrypted
          if (!monitor.secrets_encrypted) {
            results.skipped++
            continue
          }
          
          processedMonitor = decryptMonitorSecrets(monitor)
          processedMonitor.secrets_encrypted = false
          shouldUpdate = true
        }

        if (shouldUpdate) {
          const { error: updateError } = await supabaseAdmin
            .from('monitors')
            .update({
              auth_password: processedMonitor.auth_password,
              auth_token: processedMonitor.auth_token,
              slack_webhook_url: processedMonitor.slack_webhook_url,
              discord_webhook_url: processedMonitor.discord_webhook_url,
              webhook_url: processedMonitor.webhook_url,
              alert_sms: processedMonitor.alert_sms,
              secrets_encrypted: processedMonitor.secrets_encrypted
            })
            .eq('id', monitor.id)

          if (updateError) {
            results.errors.push(`Monitor ${monitor.id}: ${updateError.message}`)
          } else {
            results.processed++
          }
        }
      } catch (error) {
        results.errors.push(`Monitor ${monitor.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      action,
      results: {
        total_monitors: monitors?.length || 0,
        processed: results.processed,
        skipped: results.skipped,
        errors: results.errors.length,
        error_details: results.errors
      }
    })

  } catch (error) {
    const { createErrorResponse } = await import('@/lib/error-handler')
    return createErrorResponse(error, 500, 'POST /api/admin/encrypt-secrets')
  }
}

export async function GET(request: NextRequest) {
  try {
    // Security check
    const adminKey = request.headers.get('x-admin-key')
    if (process.env.NODE_ENV === 'production' && adminKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }

    // Get encryption status
    const { data: monitors, error } = await supabaseAdmin
      .from('monitors')
      .select('id, name, secrets_encrypted')

    if (error) throw error

    const encrypted = monitors?.filter(m => m.secrets_encrypted).length || 0
    const unencrypted = monitors?.filter(m => !m.secrets_encrypted).length || 0

    return NextResponse.json({
      total_monitors: monitors?.length || 0,
      encrypted,
      unencrypted,
      encryption_key_set: !!process.env.ENCRYPTION_KEY,
      monitors: monitors?.map(m => ({
        id: m.id,
        name: m.name,
        encrypted: m.secrets_encrypted
      }))
    })

  } catch (error) {
    const { createErrorResponse } = await import('@/lib/error-handler')
    return createErrorResponse(error, 500, 'GET /api/admin/encrypt-secrets')
  }
}