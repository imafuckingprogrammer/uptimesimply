interface SSLCheckResult {
  success: boolean
  grade?: string
  expiryDate?: Date
  daysUntilExpiry?: number
  issuer?: string
  errors?: string[]
}

export async function checkSSLCertificate(url: string): Promise<SSLCheckResult> {
  try {
    // Parse URL to get hostname
    const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`)
    const hostname = parsedUrl.hostname
    
    // For browser environment, we'll use a simplified check
    if (typeof window !== 'undefined') {
      return checkSSLInBrowser(url)
    }
    
    // Server-side SSL check using Node.js
    return checkSSLInNode(hostname)
  } catch (error: any) {
    return {
      success: false,
      errors: [error.message || 'SSL check failed']
    }
  }
}

async function checkSSLInBrowser(url: string): Promise<SSLCheckResult> {
  try {
    // Make a simple fetch request to check if SSL works
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    })
    
    // If we can connect, SSL is working
    return {
      success: true,
      grade: 'Unknown', // Can't determine grade from browser
      errors: []
    }
  } catch (error: any) {
    return {
      success: false,
      errors: [error.message || 'SSL connection failed']
    }
  }
}

async function checkSSLInNode(hostname: string): Promise<SSLCheckResult> {
  try {
    // Use Node.js tls module for detailed SSL checking
    const tls = await import('tls')
    const https = await import('https')
    
    return new Promise((resolve) => {
      const options = {
        hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: false // We want to analyze even invalid certs
      }
      
      const socket = tls.connect(options, () => {
        try {
          const cert = (socket as any).getPeerCertificate(true)
          const cipher = socket.getCipher()
          
          if (!cert || Object.keys(cert).length === 0) {
            resolve({
              success: false,
              errors: ['No certificate found']
            })
            return
          }
          
          // Calculate days until expiry
          const expiryDate = new Date(cert.valid_to)
          const now = new Date()
          const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          
          // Determine SSL grade based on various factors
          let grade = 'A'
          const errors: string[] = []
          
          // Check if certificate is expired
          if (daysUntilExpiry < 0) {
            grade = 'F'
            errors.push('Certificate expired')
          } else if (daysUntilExpiry < 7) {
            grade = 'C'
            errors.push('Certificate expires soon')
          }
          
          // Check cipher strength
          if (cipher && cipher.name) {
            if (cipher.name.includes('RC4') || cipher.name.includes('DES')) {
              grade = 'F'
              errors.push('Weak cipher suite')
            } else if (cipher.name.includes('SHA1')) {
              grade = 'B'
              errors.push('SHA1 signature')
            }
          }
          
          // Check certificate chain issues
          if (!socket.authorized) {
            const authError = (socket as any).authorizationError
            if (authError) {
              if (authError.includes('self signed')) {
                grade = 'F'
                errors.push('Self-signed certificate')
              } else if (authError.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE')) {
                grade = 'F'
                errors.push('Unable to verify certificate')
              } else {
                grade = 'C'
                errors.push(authError)
              }
            }
          }
          
          socket.end()
          
          resolve({
            success: true,
            grade,
            expiryDate,
            daysUntilExpiry,
            issuer: cert.issuer?.CN || cert.issuer?.O || 'Unknown',
            errors: errors.length > 0 ? errors : undefined
          })
        } catch (error: any) {
          socket.end()
          resolve({
            success: false,
            errors: [error.message || 'Certificate analysis failed']
          })
        }
      })
      
      socket.on('error', (error: any) => {
        resolve({
          success: false,
          errors: [error.message || 'SSL connection failed']
        })
      })
      
      socket.setTimeout(10000, () => {
        socket.destroy()
        resolve({
          success: false,
          errors: ['SSL check timeout']
        })
      })
    })
  } catch (error: any) {
    return {
      success: false,
      errors: [error.message || 'SSL check failed']
    }
  }
}

export async function updateMonitorSSLInfo(monitorId: string, url: string) {
  try {
    const sslResult = await checkSSLCertificate(url)
    
    if (!sslResult.success) {
      console.error(`SSL check failed for ${url}:`, sslResult.errors)
      return false
    }
    
    // Update monitor with SSL info
    const { supabaseAdmin } = await import('@/lib/supabase')
    
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available')
    }
    
    const updateData: any = {
      ssl_checked_at: new Date().toISOString()
    }
    
    if (sslResult.grade) {
      updateData.ssl_grade = sslResult.grade
    }
    
    if (sslResult.daysUntilExpiry !== undefined) {
      updateData.ssl_days_until_expiry = sslResult.daysUntilExpiry
    }
    
    if (sslResult.issuer) {
      updateData.ssl_issuer = sslResult.issuer
    }
    
    if (sslResult.expiryDate) {
      updateData.ssl_expiry_date = sslResult.expiryDate.toISOString()
    }
    
    const { error } = await supabaseAdmin
      .from('monitors')
      .update(updateData)
      .eq('id', monitorId)
    
    if (error) {
      console.error('Failed to update monitor SSL info:', error)
      return false
    }
    
    console.log(`✅ Updated SSL info for monitor ${monitorId}: Grade ${sslResult.grade}, expires in ${sslResult.daysUntilExpiry} days`)
    return true
  } catch (error: any) {
    console.error(`SSL update failed for monitor ${monitorId}:`, error)
    return false
  }
}