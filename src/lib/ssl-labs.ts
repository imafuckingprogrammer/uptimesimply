// SSL Labs API integration for detailed SSL certificate analysis
// API Docs: https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md

export interface SSLLabsResult {
  host: string
  port: number
  protocol: string
  isPublic: boolean
  status: string
  startTime: number
  testTime: number
  engineVersion: string
  criteriaVersion: string
  endpoints: SSLLabsEndpoint[]
}

export interface SSLLabsEndpoint {
  ipAddress: string
  serverName: string
  statusMessage: string
  grade: string
  gradeTrustIgnored: string
  hasWarnings: boolean
  isExceptional: boolean
  progress: number
  duration: number
  eta: number
  delegation: number
  details: SSLLabsDetails
}

export interface SSLLabsDetails {
  hostStartTime: number
  certChains: Array<{
    id: string
    certIds: string[]
    trustPaths: Array<{
      certs: Array<{
        subject: string
        commonNames: string[]
        altNames: string[]
        notBefore: number
        notAfter: number
        issuerSubject: string
        sigAlg: string
        revocationInfo: number
        crlURIs: string[]
        ocspURIs: string[]
        revocationStatus: number
        crlRevocationStatus: number
        ocspRevocationStatus: number
        issues: number
      }>
    }>
  }>
  protocols: Array<{
    id: number
    name: string
    version: string
  }>
  suites: {
    preference: boolean
    protocol: number
    list: Array<{
      id: number
      name: string
      cipherStrength: number
      kxType: string
      kxStrength: number
      dhBits: number
      dhP: number
      dhG: number
      dhYs: number
      namedGroupBits: number
      namedGroupId: number
      namedGroupName: string
    }>
  }
  serverSignature: string
  prefixDelegation: boolean
  nonPrefixDelegation: boolean
  vulnBeast: boolean
  renegSupport: number
  sessionResumption: number
  compressionMethods: number
  supportsNpn: boolean
  npnProtocols: string
  supportsAlpn: boolean
  alpnProtocols: string
  sessionTickets: number
  ocspStapling: boolean
  staplingRevocationStatus: number
  staplingRevocationErrorMessage: string
  sniRequired: boolean
  httpStatusCode: number
  httpForwarding: string
  supportsRc4: boolean
  rc4WithModern: boolean
  rc4Only: boolean
  forwardSecrecy: number
  protocolIntolerance: number
  miscIntolerance: number
  sims: {
    results: Array<{
      client: {
        id: number
        name: string
        version: string
        isReference: boolean
      }
      errorCode: number
      attempts: number
      protocolId: number
      suiteId: number
      suiteName: string
      kxType: string
      kxStrength: number
      dhBits: number
      dhP: number
      dhG: number
      dhYs: number
      namedGroupBits: number
      namedGroupId: number
      namedGroupName: string
      keyAlg: string
      keySize: number
      sigAlg: string
    }>
  }
  heartbleed: boolean
  heartbeat: boolean
  openSslCcs: number
  openSSLLuckyMinus20: number
  bleichenbacher: number
  poodle: boolean
  poodleTls: number
  fallbackScsv: boolean
  freak: boolean
  logjam: boolean
  chaCha20Preference: boolean
  hstsPolicy: {
    LONG_MAX_AGE: number
    header: string
    status: string
    error: string
    maxAge: number
    includeSubDomains: boolean
    preload: boolean
    directives: Array<{
      name: string
      value: string
    }>
  }
  hstsPreloads: Array<{
    source: string
    hostname: string
    status: string
    error: string
    sourceTime: number
  }>
  hpkpPolicy: {
    header: string
    status: string
    error: string
    maxAge: number
    includeSubDomains: boolean
    reportUri: string
    pins: Array<{
      hashFunction: string
      value: string
    }>
    matchedPins: Array<{
      hashFunction: string
      value: string
    }>
    directives: Array<{
      name: string
      value: string
    }>
  }
  hpkpRoPolicy: {
    header: string
    status: string
    error: string
    maxAge: number
    includeSubDomains: boolean
    reportUri: string
    pins: Array<{
      hashFunction: string
      value: string
    }>
    matchedPins: Array<{
      hashFunction: string
      value: string
    }>
    directives: Array<{
      name: string
      value: string
    }>
  }
  drownHosts: Array<{
    ip: string
    export: boolean
    port: number
    special: boolean
    sslv2: boolean
    status: string
  }>
  drownErrors: boolean
  drownVulnerable: boolean
}

export interface SimpleSSLResult {
  certificate_valid: boolean
  expires_at: string | null
  days_until_expiry: number | null
  issuer: string | null
  grade: string | null
  algorithm: string | null
  key_size: number | null
  san_domains: string[]
  warning_level: 'none' | 'warning' | 'critical'
  error_message: string | null
  has_warnings: boolean
  vulnerabilities: string[]
}

// Rate limiting: 25 assessments per hour
const RATE_LIMIT_DELAY = 150000 // 2.5 minutes between requests
const lastRequestTimes = new Map<string, number>()

// Cache for SSL Labs results to avoid repeated requests
const sslLabsCache = new Map<string, { result: SimpleSSLResult; timestamp: number }>()
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

// Cleanup expired cache entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [hostname, cached] of sslLabsCache.entries()) {
    if (now - cached.timestamp > CACHE_DURATION) {
      sslLabsCache.delete(hostname)
    }
  }
}, 60 * 60 * 1000) // Cleanup every hour

export async function analyzeSSLWithSSLLabs(hostname: string): Promise<SimpleSSLResult> {
  try {
    // Check cache first
    const cached = sslLabsCache.get(hostname)
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log(`📋 Using cached SSL Labs result for ${hostname}`)
      return cached.result
    }

    // Check rate limiting
    const lastRequest = lastRequestTimes.get(hostname) || 0
    const timeSinceLastRequest = Date.now() - lastRequest
    
    if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
      console.log(`⏰ SSL Labs rate limited for ${hostname}, falling back to simple check`)
      // Use simple SSL check instead of failing
      return await getSimpleSSLInfo(hostname)
    }

    // Start analysis - use cache if available
    console.log(`🔍 Starting SSL Labs analysis for ${hostname}`)
    
    const startResponse = await fetch(`https://api.ssllabs.com/api/v3/analyze?host=${hostname}&publish=off&all=on&fromCache=on`)
    
    if (!startResponse.ok) {
      throw new Error(`SSL Labs API error: ${startResponse.status}`)
    }

    let result = await startResponse.json()
    lastRequestTimes.set(hostname, Date.now())

    // If not ready, try to use simple SSL check as fallback
    if (result.status === 'IN_PROGRESS' || result.status === 'DNS' || result.status === 'ERROR') {
      console.log(`⚠️ SSL Labs not ready for ${hostname} (status: ${result.status}), using simple check`)
      return await getSimpleSSLInfo(hostname)
    }

    if (result.status !== 'READY') {
      console.log(`⚠️ SSL Labs unexpected status for ${hostname}: ${result.status}, using simple check`)
      return await getSimpleSSLInfo(hostname)
    }

    // Parse the results
    const endpoint = result.endpoints?.[0]
    if (!endpoint || !endpoint.details) {
      console.log(`⚠️ No SSL endpoint data for ${hostname}, using simple check`)
      return await getSimpleSSLInfo(hostname)
    }

    const details = endpoint.details
    
    // Extract basic SSL info without needing certificate details
    // We'll use the grade and vulnerability info from SSL Labs
    const vulnerabilities: string[] = []
    if (details.vulnBeast) vulnerabilities.push('BEAST')
    if (details.heartbleed) vulnerabilities.push('Heartbleed')
    if (details.poodle) vulnerabilities.push('POODLE')
    if (details.freak) vulnerabilities.push('FREAK')
    if (details.logjam) vulnerabilities.push('Logjam')
    if (details.drownVulnerable) vulnerabilities.push('DROWN')

    // Get basic cert info from simple SSL check
    const simpleInfo = await getSimpleSSLInfo(hostname)

    console.log(`✅ SSL Labs analysis complete for ${hostname}. Grade: ${endpoint.grade}`)

    const result: SimpleSSLResult = {
      certificate_valid: simpleInfo.certificate_valid,
      expires_at: simpleInfo.expires_at,
      days_until_expiry: simpleInfo.days_until_expiry,
      issuer: simpleInfo.issuer,
      grade: endpoint.grade || null, // Use SSL Labs grade
      algorithm: simpleInfo.algorithm,
      key_size: simpleInfo.key_size,
      san_domains: simpleInfo.san_domains,
      warning_level: simpleInfo.warning_level,
      error_message: endpoint.statusMessage || simpleInfo.error_message,
      has_warnings: endpoint.hasWarnings || vulnerabilities.length > 0,
      vulnerabilities // Use SSL Labs vulnerabilities
    }

    // Cache the successful result
    sslLabsCache.set(hostname, { result, timestamp: Date.now() })
    
    return result

  } catch (error: any) {
    console.error(`❌ SSL Labs analysis failed for ${hostname}:`, error.message)
    
    // Fallback to simple SSL check
    try {
      console.log(`🔄 Falling back to simple SSL check for ${hostname}`)
      return await getSimpleSSLInfo(hostname)
    } catch (fallbackError: any) {
      return {
        certificate_valid: false,
        expires_at: null,
        days_until_expiry: null,
        issuer: null,
        grade: null,
        algorithm: null,
        key_size: null,
        san_domains: [],
        warning_level: 'critical',
        error_message: `SSL analysis failed: ${error.message}`,
        has_warnings: true,
        vulnerabilities: []
      }
    }
  }
}

// Simple SSL certificate check using Node.js built-in TLS
async function getSimpleSSLInfo(hostname: string): Promise<SimpleSSLResult> {
  // Only run in Node.js environment
  if (typeof window !== 'undefined') {
    throw new Error('SSL checking only available server-side')
  }
  
  return new Promise(async (resolve, reject) => {
    try {
      const tls = await import('tls')
      const socket = tls.connect(443, hostname, {
        servername: hostname,
        rejectUnauthorized: false
      }, () => {
      const cert = socket.getPeerCertificate(true)
      socket.end()

      if (!cert || !cert.valid_from) {
        reject(new Error('No certificate information available'))
        return
      }

      // Parse expiry date
      const expiryDate = new Date(cert.valid_to)
      const now = new Date()
      const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

      // Determine warning level
      let warningLevel: 'none' | 'warning' | 'critical' = 'none'
      if (daysUntilExpiry <= 7) {
        warningLevel = 'critical'
      } else if (daysUntilExpiry <= 30) {
        warningLevel = 'warning'
      }

      // Extract SAN domains
      const sanDomains = cert.subjectaltname 
        ? cert.subjectaltname.split(', ').map((san: string) => san.replace('DNS:', ''))
        : []

      // Extract issuer
      const issuer = cert.issuer?.CN || cert.issuer?.O || 'Unknown'

      // Determine algorithm from public key type and size
      let algorithm = null
      if (cert.pubkey) {
        const keySize = cert.bits || 0
        if (keySize === 256 || keySize === 384) {
          algorithm = `ECDSA P-${keySize === 256 ? '256' : '384'}`
        } else if (keySize >= 2048) {
          algorithm = `RSA ${keySize}`
        } else if (cert.pubkey.length === 65) {
          algorithm = 'ECDSA P-256'
        } else if (cert.pubkey.length === 97) {
          algorithm = 'ECDSA P-384'
        }
      }

      resolve({
        certificate_valid: daysUntilExpiry > 0,
        expires_at: expiryDate.toISOString(),
        days_until_expiry: daysUntilExpiry,
        issuer,
        grade: null, // No grade from simple check
        algorithm: algorithm,
        key_size: cert.bits || null,
        san_domains: sanDomains,
        warning_level: warningLevel,
        error_message: null,
        has_warnings: daysUntilExpiry <= 30,
        vulnerabilities: []
      })
    })

    socket.on('error', (error: any) => {
      reject(new Error(`SSL connection failed: ${error.message}`))
    })

    socket.setTimeout(10000, () => {
      socket.destroy()
      reject(new Error('SSL connection timeout'))
    })
    } catch (error) {
      reject(error)
    }
  })
}