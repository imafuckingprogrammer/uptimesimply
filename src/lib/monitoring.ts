interface MonitorConfig {
  url: string
  method?: string
  headers?: Record<string, string>
  body?: string
  authType?: 'none' | 'basic' | 'bearer' | 'header'
  authUsername?: string
  authPassword?: string
  authToken?: string
  timeoutMs?: number
}

export async function checkWebsiteHealth(config: MonitorConfig | string, timeoutMs: number = 15000) {
  const startTime = Date.now()
  
  // Backward compatibility - if string is passed, use old behavior
  if (typeof config === 'string') {
    config = { url: config, timeoutMs }
  }
  
  const {
    url,
    method = 'GET',
    headers = {},
    body,
    authType = 'none',
    authUsername,
    authPassword,
    authToken,
    timeoutMs: configTimeout = timeoutMs
  } = config
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), configTimeout)
    
    // Build headers
    const requestHeaders: Record<string, string> = {
      'User-Agent': 'SimpleUptime/1.0 Monitor',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...headers
    }
    
    // Add authentication headers
    if (authType === 'basic' && authUsername && authPassword) {
      const credentials = btoa(`${authUsername}:${authPassword}`)
      requestHeaders['Authorization'] = `Basic ${credentials}`
    } else if (authType === 'bearer' && authToken) {
      requestHeaders['Authorization'] = `Bearer ${authToken}`
    } else if (authType === 'header' && authToken) {
      // For custom header auth like API keys
      requestHeaders['X-API-Key'] = authToken
    }
    
    // Add content-type for requests with body
    if (body && !requestHeaders['Content-Type']) {
      requestHeaders['Content-Type'] = 'application/json'
    }
    
    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers: requestHeaders,
      body: body || undefined,
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    return {
      success: true,
      status: response.ok ? 'up' : 'down',
      statusCode: response.status,
      responseTime,
      error: response.ok ? null : `HTTP ${response.status}: ${response.statusText}`
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        status: 'timeout',
        statusCode: null,
        responseTime,
        error: `Request timeout after ${configTimeout}ms`
      }
    }
    
    const { logError, handleNetworkError } = await import('./error-handler')
    
    try {
      handleNetworkError(error, 'Website health check')
    } catch (handledError) {
      const standardError = logError(handledError, 'checkWebsiteHealth')
      return {
        success: false,
        status: 'error',
        statusCode: null,
        responseTime,
        error: standardError.message
      }
    }
  }
}

// Ping monitoring function
export async function checkPingHealth(hostname: string, timeoutMs: number = 5000) {
  const startTime = Date.now()
  
  try {
    // Extract hostname from URL if needed
    let host = hostname
    if (hostname.startsWith('http')) {
      host = new URL(hostname).hostname
    }
    
    // Server-side: Use real ping when available
    if (typeof window === 'undefined') {
      try {
        const ping = await import('ping')
        const config = {
          timeout: Math.floor(timeoutMs / 1000), // Convert to seconds
          min_reply: 1,
          extra: ['-c', '1'] // Send only 1 packet
        }
        
        const result = await ping.promise.probe(host, config)
        const responseTime = result.time === 'unknown' ? Date.now() - startTime : parseFloat(String(result.time))
        
        if (result.alive) {
          return {
            success: true,
            status: 'up',
            statusCode: null,
            responseTime: Math.round(responseTime),
            error: null
          }
        } else {
          return {
            success: false,
            status: 'down',
            statusCode: null,
            responseTime: Math.round(responseTime),
            error: 'Host unreachable via ping'
          }
        }
      } catch (pingError: any) {
        // Fallback to TCP connection test if ping fails
        console.warn('Real ping failed, falling back to TCP test:', pingError.message)
      }
    }
    
    // Fallback: TCP connection test (works in browser and when ping fails)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    
    try {
      // Try TCP connection test via fetch with minimal data transfer
      const response = await fetch(`https://${host}`, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'no-cors' // Allow cross-origin requests without response data
      }).catch(() => {
        // If HTTPS fails, try HTTP
        return fetch(`http://${host}`, {
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors'
        })
      })
      
      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime
      
      return {
        success: true,
        status: 'up',
        statusCode: response.status || null,
        responseTime,
        error: null
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime
      
      if (fetchError.name === 'AbortError') {
        return {
          success: false,
          status: 'timeout',
          statusCode: null,
          responseTime,
          error: `Connection timeout after ${timeoutMs}ms`
        }
      }
      
      return {
        success: false,
        status: 'down',
        statusCode: null,
        responseTime,
        error: fetchError.message || 'Host unreachable'
      }
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    
    return {
      success: false,
      status: 'error',
      statusCode: null,
      responseTime,
      error: error.message || 'Ping check failed'
    }
  }
}

// Port monitoring function (server-side only)
export async function checkPortHealth(hostname: string, port: number, timeoutMs: number = 5000) {
  const startTime = Date.now()
  
  // Only run in Node.js environment
  if (typeof window !== 'undefined') {
    return {
      success: false,
      status: 'error',
      statusCode: null,
      responseTime: 0,
      error: 'Port monitoring only available server-side'
    }
  }
  
  try {
    // Dynamic import for Node.js modules
    const net = await import('net')
    
    return new Promise((resolve) => {
      const socket = new net.Socket()
      let resolved = false
      
      const cleanup = () => {
        if (!resolved) {
          resolved = true
          socket.destroy()
        }
      }
      
      socket.setTimeout(timeoutMs)
      
      socket.on('connect', () => {
        const responseTime = Date.now() - startTime
        cleanup()
        resolve({
          success: true,
          status: 'up',
          statusCode: null,
          responseTime,
          error: null
        })
      })
      
      socket.on('timeout', () => {
        const responseTime = Date.now() - startTime
        cleanup()
        resolve({
          success: false,
          status: 'timeout',
          statusCode: null,
          responseTime,
          error: `Port ${port} timeout after ${timeoutMs}ms`
        })
      })
      
      socket.on('error', (error: any) => {
        const responseTime = Date.now() - startTime
        cleanup()
        resolve({
          success: false,
          status: 'down',
          statusCode: null,
          responseTime,
          error: `Port ${port} unreachable: ${error.message}`
        })
      })
      
      socket.connect(port, hostname)
    })
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    
    return {
      success: false,
      status: 'error',
      statusCode: null,
      responseTime,
      error: error.message || 'Port check error'
    }
  }
}

export function determineOverallStatus(locationResults: Array<{ status: string }>) {
  const downCount = locationResults.filter(r => 
    r.status === 'down' || r.status === 'timeout' || r.status === 'error'
  ).length
  
  const totalLocations = locationResults.length
  
  // Site is considered down if majority of locations report it as down
  // For 5 locations: 3+ must agree, for 3 locations: 2+ must agree
  const threshold = totalLocations >= 5 ? 3 : 2
  return downCount >= threshold ? 'down' : 'up'
}

export function calculateAverageResponseTime(locationResults: Array<{ status: string; responseTime?: number }>) {
  const successfulChecks = locationResults.filter(r => 
    r.status === 'up' && r.responseTime
  )
  
  if (successfulChecks.length === 0) return null
  
  const totalTime = successfulChecks.reduce((sum, r) => sum + (r.responseTime || 0), 0)
  return Math.round(totalTime / successfulChecks.length)
}