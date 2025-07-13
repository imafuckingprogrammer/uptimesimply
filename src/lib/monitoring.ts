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
    
    return {
      success: false,
      status: 'error',
      statusCode: null,
      responseTime,
      error: error.message || 'Network error'
    }
  }
}

// Ping monitoring function
export async function checkPingHealth(hostname: string, timeoutMs: number = 5000) {
  const startTime = Date.now()
  
  try {
    // Use a simple TCP connection test as ping alternative
    // (Real ping requires root privileges)
    const url = hostname.startsWith('http') ? hostname : `https://${hostname}`
    const host = new URL(url).hostname
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    
    // Try to establish a connection
    const response = await fetch(`https://${host}`, {
      method: 'HEAD',
      signal: controller.signal,
    }).catch(() => {
      // If HTTPS fails, try HTTP
      return fetch(`http://${host}`, {
        method: 'HEAD',
        signal: controller.signal,
      })
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    return {
      success: true,
      status: 'up',
      statusCode: response.status,
      responseTime,
      error: null
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        status: 'timeout',
        statusCode: null,
        responseTime,
        error: `Ping timeout after ${timeoutMs}ms`
      }
    }
    
    return {
      success: false,
      status: 'down',
      statusCode: null,
      responseTime,
      error: error.message || 'Host unreachable'
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