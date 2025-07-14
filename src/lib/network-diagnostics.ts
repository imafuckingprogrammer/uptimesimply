// Enhanced network diagnostics for incident analysis
// This provides detailed troubleshooting data when sites go down

export interface NetworkDiagnostics {
  dns_resolution: DNSResult
  traceroute: TracerouteResult  
  http_details: HTTPDiagnostics
  ssl_verification: SSLDiagnostics
  geo_analysis: GeoAnalysis
  timestamp: string
}

export interface DNSResult {
  success: boolean
  resolved_ips: string[]
  resolution_time_ms: number
  nameservers: string[]
  dns_errors: string[]
  cname_chain: string[]
  mx_records: string[]
  txt_records: string[]
}

export interface TracerouteResult {
  success: boolean
  total_hops: number
  total_time_ms: number
  hops: TracerouteHop[]
  packet_loss: number
  max_timeout_reached: boolean
}

export interface TracerouteHop {
  hop_number: number
  ip_address: string
  hostname: string | null
  response_times: number[] // 3 pings per hop
  avg_time_ms: number
  location: string | null
  asn: string | null
  timeout: boolean
}

export interface HTTPDiagnostics {
  connection_time_ms: number
  ssl_handshake_time_ms: number
  first_byte_time_ms: number
  total_time_ms: number
  response_headers: Record<string, string>
  status_code: number
  status_text: string
  response_size_bytes: number
  redirect_chain: string[]
  content_type: string
  server_info: string
  error_details: string | null
}

export interface SSLDiagnostics {
  certificate_valid: boolean
  certificate_chain_length: number
  cipher_suite: string
  tls_version: string
  certificate_issuer: string
  certificate_expiry: string
  san_domains: string[]
  ssl_errors: string[]
  ocsp_status: string
}

export interface GeoAnalysis {
  server_location: {
    country: string
    city: string
    latitude: number
    longitude: number
  }
  cdn_detection: {
    is_cdn: boolean
    cdn_provider: string | null
    edge_location: string | null
  }
  network_info: {
    asn: string
    isp: string
    organization: string
  }
}

// Main diagnostic function
export async function runNetworkDiagnostics(url: string, location = 'us-east'): Promise<NetworkDiagnostics> {
  const startTime = Date.now()
  
  try {
    const hostname = new URL(url).hostname
    
    // Run all diagnostics in parallel for speed
    const [dnsResult, httpDetails, sslDiagnostics] = await Promise.allSettled([
      performDNSLookup(hostname),
      performHTTPDiagnostics(url),
      performSSLDiagnostics(hostname)
    ])
    
    // Traceroute is more intensive, run separately
    const tracerouteResult = await performTraceroute(hostname)
    
    // Get geo analysis from resolved IPs
    const geoAnalysis = dnsResult.status === 'fulfilled' && dnsResult.value.resolved_ips.length > 0
      ? await performGeoAnalysis(dnsResult.value.resolved_ips[0])
      : getDefaultGeoAnalysis()
    
    return {
      dns_resolution: dnsResult.status === 'fulfilled' ? dnsResult.value : getDefaultDNSResult(),
      traceroute: tracerouteResult,
      http_details: httpDetails.status === 'fulfilled' ? httpDetails.value : getDefaultHTTPDiagnostics(),
      ssl_verification: sslDiagnostics.status === 'fulfilled' ? sslDiagnostics.value : getDefaultSSLDiagnostics(),
      geo_analysis: geoAnalysis,
      timestamp: new Date().toISOString()
    }
  } catch (error: any) {
    console.error('Network diagnostics failed:', error)
    return getDefaultNetworkDiagnostics(error.message)
  }
}

// DNS lookup with detailed information
async function performDNSLookup(hostname: string): Promise<DNSResult> {
  try {
    const startTime = Date.now()
    
    // Basic DNS resolution
    const response = await fetch(`https://dns.google/resolve?name=${hostname}&type=A`)
    const dnsData = await response.json()
    
    const resolutionTime = Date.now() - startTime
    
    const resolved_ips = dnsData.Answer 
      ? dnsData.Answer.filter((a: any) => a.type === 1).map((a: any) => a.data)
      : []
    
    // Get additional DNS records
    const [cnameResponse, mxResponse, txtResponse] = await Promise.allSettled([
      fetch(`https://dns.google/resolve?name=${hostname}&type=CNAME`),
      fetch(`https://dns.google/resolve?name=${hostname}&type=MX`),
      fetch(`https://dns.google/resolve?name=${hostname}&type=TXT`)
    ])
    
    const cname_chain = cnameResponse.status === 'fulfilled' 
      ? await cnameResponse.value.json().then(d => d.Answer?.map((a: any) => a.data) || [])
      : []
      
    const mx_records = mxResponse.status === 'fulfilled'
      ? await mxResponse.value.json().then(d => d.Answer?.map((a: any) => a.data) || [])
      : []
      
    const txt_records = txtResponse.status === 'fulfilled'
      ? await txtResponse.value.json().then(d => d.Answer?.map((a: any) => a.data) || [])
      : []
    
    return {
      success: resolved_ips.length > 0,
      resolved_ips,
      resolution_time_ms: resolutionTime,
      nameservers: dnsData.Authority?.map((a: any) => a.data) || [],
      dns_errors: dnsData.Status !== 0 ? [`DNS Status: ${dnsData.Status}`] : [],
      cname_chain,
      mx_records,
      txt_records
    }
  } catch (error: any) {
    return {
      success: false,
      resolved_ips: [],
      resolution_time_ms: 0,
      nameservers: [],
      dns_errors: [error.message],
      cname_chain: [],
      mx_records: [],
      txt_records: []
    }
  }
}

// Real traceroute implementation (server-side only)
async function performTraceroute(hostname: string): Promise<TracerouteResult> {
  try {
    // Server-side: Use real traceroute when available
    if (typeof window === 'undefined') {
      try {
        const traceroute = await import('nodejs-traceroute')
        
        return new Promise((resolve) => {
          const hops: TracerouteHop[] = []
          let totalTime = 0
          const startTime = Date.now()
          
          const tracer = traceroute.trace(hostname)
          
          tracer.on('hop', (hop: any) => {
            const hopTime = hop.rtt1 || hop.rtt2 || hop.rtt3 || 0
            totalTime += hopTime
            
            hops.push({
              hop_number: hop.hop,
              ip_address: hop.ip || '*',
              hostname: hop.hostname || null,
              response_times: [hop.rtt1 || 0, hop.rtt2 || 0, hop.rtt3 || 0],
              avg_time_ms: hopTime,
              location: null, // Could be enhanced with IP geolocation
              asn: null,
              timeout: hop.ip === '*'
            })
          })
          
          tracer.on('close', (code: number) => {
            const finalTotalTime = Date.now() - startTime
            const timeoutHops = hops.filter(h => h.timeout)
            
            resolve({
              success: hops.length > 0 && hops.some(h => !h.timeout),
              total_hops: hops.length,
              total_time_ms: totalTime > 0 ? totalTime : finalTotalTime,
              hops,
              packet_loss: hops.length > 0 ? (timeoutHops.length / hops.length) * 100 : 100,
              max_timeout_reached: timeoutHops.length > 0
            })
          })
          
          tracer.on('error', (error: any) => {
            console.warn('Real traceroute failed, falling back to simulation:', error.message)
            resolve(performSimulatedTraceroute(hostname))
          })
          
          // Timeout after 30 seconds
          setTimeout(() => {
            tracer.kill()
            if (hops.length === 0) {
              resolve(performSimulatedTraceroute(hostname))
            }
          }, 30000)
        })
      } catch (tracerouteError: any) {
        console.warn('Traceroute library unavailable, falling back to simulation:', tracerouteError.message)
        return performSimulatedTraceroute(hostname)
      }
    }
    
    // Browser fallback: Use simulated traceroute
    return performSimulatedTraceroute(hostname)
  } catch (error: any) {
    return {
      success: false,
      total_hops: 0,
      total_time_ms: 0,
      hops: [],
      packet_loss: 100,
      max_timeout_reached: true
    }
  }
}

// Fallback: Simulated traceroute for browser/when real traceroute fails
async function performSimulatedTraceroute(hostname: string): Promise<TracerouteResult> {
  try {
    // Use connectivity tests to intermediate hops as a simulation
    const testHops = [
      { name: 'Local Gateway', url: `https://1.1.1.1/cdn-cgi/trace` },
      { name: 'Public DNS', url: `https://8.8.8.8/` },
      { name: 'Target', url: `https://${hostname}` }
    ]
    
    const hops: TracerouteHop[] = []
    let totalTime = 0
    
    for (let i = 0; i < testHops.length; i++) {
      const hopStart = Date.now()
      
      try {
        const response = await fetch(testHops[i].url, { 
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        })
        
        const hopTime = Date.now() - hopStart
        totalTime += hopTime
        
        hops.push({
          hop_number: i + 1,
          ip_address: 'simulated',
          hostname: testHops[i].name,
          response_times: [hopTime, hopTime, hopTime],
          avg_time_ms: hopTime,
          location: null,
          asn: null,
          timeout: false
        })
      } catch (error) {
        hops.push({
          hop_number: i + 1,
          ip_address: '*',
          hostname: testHops[i].name,
          response_times: [0, 0, 0],
          avg_time_ms: 0,
          location: null,
          asn: null,
          timeout: true
        })
      }
    }
    
    return {
      success: hops.some(h => !h.timeout),
      total_hops: hops.length,
      total_time_ms: totalTime,
      hops,
      packet_loss: hops.filter(h => h.timeout).length / hops.length * 100,
      max_timeout_reached: hops.some(h => h.timeout)
    }
  } catch (error: any) {
    return {
      success: false,
      total_hops: 0,
      total_time_ms: 0,
      hops: [],
      packet_loss: 100,
      max_timeout_reached: true
    }
  }
}

// Detailed HTTP diagnostics with more accurate timing
async function performHTTPDiagnostics(url: string): Promise<HTTPDiagnostics> {
  const startTime = Date.now()
  let dnsTime = 0
  let connectTime = 0
  let sslTime = 0
  let firstByteTime = 0
  
  try {
    // For better timing accuracy, we'll use multiple timing points
    const dnsStart = Date.now()
    
    // Get hostname for DNS timing simulation
    const hostname = new URL(url).hostname
    
    // Simulate DNS resolution timing (rough estimate)
    try {
      const dns = require('dns').promises
      await dns.lookup(hostname)
      dnsTime = Date.now() - dnsStart
    } catch {
      dnsTime = Math.round(Math.random() * 50 + 10) // 10-60ms estimate
    }
    
    const connectStart = Date.now()
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(15000)
    })
    
    firstByteTime = Date.now() - startTime
    const totalTime = Date.now() - startTime
    connectTime = Math.max(0, firstByteTime - dnsTime)
    
    // Estimate SSL handshake time for HTTPS
    sslTime = url.startsWith('https') ? Math.round(connectTime * 0.4) : 0
    const tcpConnectTime = connectTime - sslTime
    
    // Extract headers
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      headers[key] = value
    })
    
    // Build redirect chain
    const redirectChain = [url]
    if (response.redirected && response.url !== url) {
      redirectChain.push(response.url)
    }
    
    return {
      connection_time_ms: Math.round(tcpConnectTime),
      ssl_handshake_time_ms: sslTime,
      first_byte_time_ms: firstByteTime,
      total_time_ms: totalTime,
      response_headers: headers,
      status_code: response.status,
      status_text: response.statusText,
      response_size_bytes: parseInt(headers['content-length'] || '0'),
      redirect_chain: redirectChain,
      content_type: headers['content-type'] || 'unknown',
      server_info: headers['server'] || 'unknown',
      error_details: null
    }
  } catch (error: any) {
    const failureTime = Date.now() - startTime
    
    return {
      connection_time_ms: 0,
      ssl_handshake_time_ms: 0,
      first_byte_time_ms: 0,
      total_time_ms: failureTime,
      response_headers: {},
      status_code: 0,
      status_text: 'Error',
      response_size_bytes: 0,
      redirect_chain: [url],
      content_type: 'error',
      server_info: 'error',
      error_details: error.message
    }
  }
}

// SSL/TLS diagnostics using real SSL monitoring
async function performSSLDiagnostics(hostname: string): Promise<SSLDiagnostics> {
  try {
    // Use our comprehensive SSL monitoring system
    const { checkSSLCertificate } = await import('./ssl-monitoring')
    const sslResult = await checkSSLCertificate(hostname, 443)
    
    return {
      certificate_valid: sslResult.certificate_valid,
      certificate_chain_length: 1, // Basic implementation
      cipher_suite: sslResult.algorithm || 'unknown',
      tls_version: 'TLS 1.2+', // Modern TLS assumption
      certificate_issuer: sslResult.issuer || 'unknown',
      certificate_expiry: sslResult.expires_at || 'unknown',
      san_domains: sslResult.san_domains,
      ssl_errors: sslResult.error_message ? [sslResult.error_message] : [],
      ocsp_status: sslResult.certificate_valid ? 'good' : 'unknown'
    }
  } catch (error: any) {
    // Fallback to basic check if SSL monitoring fails
    try {
      const response = await fetch(`https://${hostname}`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000)
      })
      
      return {
        certificate_valid: response.ok,
        certificate_chain_length: 0,
        cipher_suite: 'unknown',
        tls_version: 'unknown', 
        certificate_issuer: 'unknown',
        certificate_expiry: 'unknown',
        san_domains: [],
        ssl_errors: response.ok ? [] : ['SSL handshake failed'],
        ocsp_status: 'unknown'
      }
    } catch (fallbackError: any) {
      return {
        certificate_valid: false,
        certificate_chain_length: 0,
        cipher_suite: 'error',
        tls_version: 'error',
        certificate_issuer: 'error',
        certificate_expiry: 'error',
        san_domains: [],
        ssl_errors: [error.message, fallbackError.message],
        ocsp_status: 'error'
      }
    }
  }
}

// IP geolocation and network analysis
async function performGeoAnalysis(ip: string): Promise<GeoAnalysis> {
  try {
    // Use ipapi.co for free IP geolocation
    const response = await fetch(`https://ipapi.co/${ip}/json/`)
    const data = await response.json()
    
    return {
      server_location: {
        country: data.country_name || 'Unknown',
        city: data.city || 'Unknown',
        latitude: data.latitude || 0,
        longitude: data.longitude || 0
      },
      cdn_detection: {
        is_cdn: data.org?.toLowerCase().includes('cloudflare') || 
               data.org?.toLowerCase().includes('amazon') ||
               data.org?.toLowerCase().includes('fastly') || false,
        cdn_provider: data.org || null,
        edge_location: `${data.city}, ${data.country_name}`
      },
      network_info: {
        asn: data.asn || 'Unknown',
        isp: data.org || 'Unknown',
        organization: data.org || 'Unknown'
      }
    }
  } catch (error) {
    return getDefaultGeoAnalysis()
  }
}

// Default fallback functions
function getDefaultNetworkDiagnostics(error: string): NetworkDiagnostics {
  return {
    dns_resolution: getDefaultDNSResult(),
    traceroute: { success: false, total_hops: 0, total_time_ms: 0, hops: [], packet_loss: 100, max_timeout_reached: true },
    http_details: getDefaultHTTPDiagnostics(),
    ssl_verification: getDefaultSSLDiagnostics(),
    geo_analysis: getDefaultGeoAnalysis(),
    timestamp: new Date().toISOString()
  }
}

function getDefaultDNSResult(): DNSResult {
  return {
    success: false,
    resolved_ips: [],
    resolution_time_ms: 0,
    nameservers: [],
    dns_errors: ['DNS lookup failed'],
    cname_chain: [],
    mx_records: [],
    txt_records: []
  }
}

function getDefaultHTTPDiagnostics(): HTTPDiagnostics {
  return {
    connection_time_ms: 0,
    ssl_handshake_time_ms: 0,
    first_byte_time_ms: 0,
    total_time_ms: 0,
    response_headers: {},
    status_code: 0,
    status_text: 'Error',
    response_size_bytes: 0,
    redirect_chain: [],
    content_type: 'error',
    server_info: 'error',
    error_details: 'Connection failed'
  }
}

function getDefaultSSLDiagnostics(): SSLDiagnostics {
  return {
    certificate_valid: false,
    certificate_chain_length: 0,
    cipher_suite: 'unknown',
    tls_version: 'unknown',
    certificate_issuer: 'unknown',
    certificate_expiry: 'unknown',
    san_domains: [],
    ssl_errors: ['SSL check failed'],
    ocsp_status: 'unknown'
  }
}

function getDefaultGeoAnalysis(): GeoAnalysis {
  return {
    server_location: {
      country: 'Unknown',
      city: 'Unknown',
      latitude: 0,
      longitude: 0
    },
    cdn_detection: {
      is_cdn: false,
      cdn_provider: null,
      edge_location: null
    },
    network_info: {
      asn: 'Unknown',
      isp: 'Unknown',
      organization: 'Unknown'
    }
  }
}