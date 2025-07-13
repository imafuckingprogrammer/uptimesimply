import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkSSLCertificate, checkDomainExpiration, extractDomainFromUrl, extractRootDomain, extractPortFromUrl } from '@/lib/ssl-monitoring-simple'
import { analyzeSSLWithSSLLabs } from '@/lib/ssl-labs'
import { sendSSLAlert, sendDomainAlert } from '@/lib/email'

export async function GET() {
  return POST(new NextRequest('http://localhost:3000/api/cron/check-ssl', { method: 'GET' }))
}

export async function POST(request: NextRequest) {
  try {
    // Verify this is a cron request (in production, check auth headers)
    const authHeader = request.headers.get('authorization')
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔒 Starting SSL and domain checks...')

    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }

    // Get all active monitors with SSL/domain checking enabled
    const { data: monitors, error: monitorsError } = await supabaseAdmin
      .from('monitors')
      .select('*')
      .or('ssl_enabled.eq.true,domain_enabled.eq.true')

    if (monitorsError) throw monitorsError

    const results = []

    for (const monitor of monitors || []) {
      const hostname = extractDomainFromUrl(monitor.url)
      const rootDomain = extractRootDomain(hostname)
      const port = extractPortFromUrl(monitor.url)
      
      console.log(`Checking SSL/Domain for ${monitor.name} (SSL: ${hostname}, Domain: ${rootDomain})`)

      // SSL Certificate Check
      if (monitor.ssl_enabled) {
        try {
          // Use SSL Labs for detailed analysis
          const sslResult = await analyzeSSLWithSSLLabs(hostname)
          
          // Store SSL check result
          await supabaseAdmin
            .from('ssl_checks')
            .insert({
              monitor_id: monitor.id,
              certificate_valid: sslResult.certificate_valid,
              expires_at: sslResult.expires_at,
              days_until_expiry: sslResult.days_until_expiry,
              issuer: sslResult.issuer,
              algorithm: sslResult.algorithm,
              key_size: sslResult.key_size,
              san_domains: sslResult.san_domains,
              warning_level: sslResult.warning_level,
              error_message: sslResult.error_message,
              grade: sslResult.grade,
              has_warnings: sslResult.has_warnings,
              vulnerabilities: sslResult.vulnerabilities
            })

          // Update monitor with SSL info
          await supabaseAdmin
            .from('monitors')
            .update({
              ssl_expiry_date: sslResult.expires_at,
              ssl_issuer: sslResult.issuer,
              ssl_days_until_expiry: sslResult.days_until_expiry,
              ssl_grade: sslResult.grade,
              ssl_has_warnings: sslResult.has_warnings,
              ssl_vulnerabilities: sslResult.vulnerabilities
            })
            .eq('id', monitor.id)

          // Send SSL alerts if needed
          if (sslResult.warning_level === 'critical' && monitor.alert_email) {
            console.log(`🚨 SSL Certificate critical for ${monitor.name}`)
            
            await sendSSLAlert({
              recipient: monitor.alert_email,
              monitorName: monitor.name,
              monitorUrl: monitor.url,
              alertType: 'ssl_expiring',
              daysUntilExpiry: sslResult.days_until_expiry || 0,
              issuer: sslResult.issuer || 'Unknown',
              errorMessage: sslResult.error_message
            })
          } else if (sslResult.warning_level === 'warning' && monitor.alert_email) {
            console.log(`⚠️ SSL Certificate warning for ${monitor.name}`)
            
            await sendSSLAlert({
              recipient: monitor.alert_email,
              monitorName: monitor.name,
              monitorUrl: monitor.url,
              alertType: 'ssl_warning',
              daysUntilExpiry: sslResult.days_until_expiry || 0,
              issuer: sslResult.issuer || 'Unknown',
              errorMessage: sslResult.error_message
            })
          }

          results.push({
            monitor: monitor.name,
            ssl_check: sslResult
          })
        } catch (error: any) {
          console.error(`SSL check failed for ${monitor.name}:`, error)
          results.push({
            monitor: monitor.name,
            ssl_check: { error: error.message }
          })
        }
      }

      // Domain Expiration Check
      if (monitor.domain_enabled) {
        try {
          const domainResult = await checkDomainExpiration(rootDomain)
          
          // Store domain check result
          await supabaseAdmin
            .from('domain_checks')
            .insert({
              monitor_id: monitor.id,
              domain_valid: domainResult.domain_valid,
              expires_at: domainResult.expires_at,
              days_until_expiry: domainResult.days_until_expiry,
              registrar: domainResult.registrar,
              name_servers: domainResult.name_servers,
              warning_level: domainResult.warning_level,
              error_message: domainResult.error_message
            })

          // Update monitor with domain info
          await supabaseAdmin
            .from('monitors')
            .update({
              domain_expiry_date: domainResult.expires_at,
              domain_registrar: domainResult.registrar,
              domain_days_until_expiry: domainResult.days_until_expiry
            })
            .eq('id', monitor.id)

          // Send domain alerts if needed
          if (domainResult.warning_level === 'critical' && monitor.alert_email && domainResult.days_until_expiry !== null) {
            console.log(`🚨 Domain expiring soon for ${monitor.name}`)
            
            await sendDomainAlert({
              recipient: monitor.alert_email,
              monitorName: monitor.name,
              domain: rootDomain,
              alertType: 'domain_expiring',
              daysUntilExpiry: domainResult.days_until_expiry,
              registrar: domainResult.registrar || 'Unknown'
            })
          }

          results.push({
            monitor: monitor.name,
            domain_check: domainResult
          })
        } catch (error: any) {
          console.error(`Domain check failed for ${monitor.name}:`, error)
          results.push({
            monitor: monitor.name,
            domain_check: { error: error.message }
          })
        }
      }

      // Add small delay to avoid overwhelming external services
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(`✅ SSL/Domain checks completed: ${results.length} monitors checked`)

    return NextResponse.json({ 
      success: true, 
      checked_at: new Date().toISOString(),
      results 
    })
  } catch (error) {
    console.error('Error in SSL/domain check cron:', error)
    return NextResponse.json({ error: 'Failed to check SSL/domains' }, { status: 500 })
  }
}