import * as tls from 'tls'
import * as crypto from 'crypto'

export interface SSLCheckResult {
  certificate_valid: boolean
  expires_at: string | null
  days_until_expiry: number | null
  issuer: string | null
  algorithm: string | null
  key_size: number | null
  san_domains: string[]
  warning_level: 'none' | 'warning' | 'critical'
  error_message: string | null
}

export interface DomainCheckResult {
  domain_valid: boolean
  expires_at: string | null
  days_until_expiry: number | null
  registrar: string | null
  name_servers: string[]
  warning_level: 'none' | 'warning' | 'critical'
  error_message: string | null
}

export async function checkSSLCertificate(hostname: string, port: number = 443): Promise<SSLCheckResult> {
  return new Promise((resolve) => {
    const startTime = Date.now()
    
    const socket = tls.connect(port, hostname, { 
      servername: hostname,
      timeout: 10000,
      rejectUnauthorized: false, // We want to check invalid certs too
      secureProtocol: 'TLS_method', // Fix for modern TLS
      ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA' // Compatible ciphers
    })

    socket.on('secureConnect', () => {
      try {
        const cert = socket.getPeerCertificate(true)
        const cipher = socket.getCipher()
        
        if (!cert || Object.keys(cert).length === 0) {
          socket.end()
          return resolve({
            certificate_valid: false,
            expires_at: null,
            days_until_expiry: null,
            issuer: null,
            algorithm: null,
            key_size: null,
            san_domains: [],
            warning_level: 'critical',
            error_message: 'No certificate found'
          })
        }

        const expiryDate = new Date(cert.valid_to)
        const now = new Date()
        const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        
        // Check if certificate is valid
        const isValid = socket.authorized && daysUntilExpiry > 0
        
        // Determine warning level
        let warningLevel: 'none' | 'warning' | 'critical' = 'none'
        if (daysUntilExpiry <= 7) {
          warningLevel = 'critical'
        } else if (daysUntilExpiry <= 30) {
          warningLevel = 'warning'
        }

        // Extract SAN domains
        const sanDomains: string[] = []
        if (cert.subjectaltname) {
          const sans = cert.subjectaltname.split(', ')
          sans.forEach(san => {
            if (san.startsWith('DNS:')) {
              sanDomains.push(san.substring(4))
            }
          })
        }

        // Get public key info
        let keySize: number | null = null
        if (cert.pubkey) {
          const publicKey = crypto.createPublicKey(cert.pubkey)
          keySize = (publicKey as any).asymmetricKeySize ? (publicKey as any).asymmetricKeySize * 8 : null
        }

        socket.end()
        resolve({
          certificate_valid: isValid,
          expires_at: expiryDate.toISOString(),
          days_until_expiry: daysUntilExpiry,
          issuer: cert.issuer?.CN || cert.issuer?.O || null,
          algorithm: cipher?.name || null,
          key_size: keySize,
          san_domains: sanDomains,
          warning_level: warningLevel,
          error_message: socket.authorized ? null : socket.authorizationError?.message || 'Certificate validation failed'
        })
      } catch (error: any) {
        socket.end()
        resolve({
          certificate_valid: false,
          expires_at: null,
          days_until_expiry: null,
          issuer: null,
          algorithm: null,
          key_size: null,
          san_domains: [],
          warning_level: 'critical',
          error_message: error.message || 'SSL check failed'
        })
      }
    })

    socket.on('error', (error) => {
      resolve({
        certificate_valid: false,
        expires_at: null,
        days_until_expiry: null,
        issuer: null,
        algorithm: null,
        key_size: null,
        san_domains: [],
        warning_level: 'critical',
        error_message: error.message || 'SSL connection failed'
      })
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve({
        certificate_valid: false,
        expires_at: null,
        days_until_expiry: null,
        issuer: null,
        algorithm: null,
        key_size: null,
        san_domains: [],
        warning_level: 'critical',
        error_message: 'SSL connection timeout'
      })
    })
  })
}

export async function checkDomainExpiration(domain: string): Promise<DomainCheckResult> {
  try {
    const whoisJson = require('whois-json')
    const dns = require('dns').promises
    
    // Get nameservers via DNS
    let nameservers: string[] = []
    try {
      nameservers = await dns.resolveNs(domain)
    } catch {
      // Continue with WHOIS even if DNS fails
    }
    
    try {
      // Perform WHOIS lookup
      const whoisData = await whoisJson(domain)
      
      if (!whoisData) {
        return {
          domain_valid: false,
          expires_at: null,
          days_until_expiry: null,
          registrar: null,
          name_servers: nameservers,
          warning_level: 'critical',
          error_message: 'No WHOIS data found for domain'
        }
      }
      
      // Extract expiration date - try multiple common field names
      let expirationDate: Date | null = null
      const expirationFields = [
        'registryExpiryDate',
        'registrarExpirationDate', 
        'expirationDate',
        'expiry',
        'expires',
        'expiryDate',
        'registrar_registration_expiration_date',
        'registry_expiry_date'
      ]
      
      for (const field of expirationFields) {
        const value = whoisData[field]
        if (value) {
          const date = new Date(value)
          if (!isNaN(date.getTime())) {
            expirationDate = date
            break
          }
        }
      }
      
      // Extract registrar - try multiple common field names
      let registrar: string | null = null
      const registrarFields = ['registrar', 'registrarName', 'sponsoring_registrar']
      for (const field of registrarFields) {
        if (whoisData[field]) {
          registrar = whoisData[field]
          break
        }
      }
      
      // Calculate days until expiry
      let daysUntilExpiry: number | null = null
      let warningLevel: 'none' | 'warning' | 'critical' = 'none'
      
      if (expirationDate) {
        const now = new Date()
        daysUntilExpiry = Math.floor((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        
        // Set warning levels
        if (daysUntilExpiry <= 7) {
          warningLevel = 'critical'
        } else if (daysUntilExpiry <= 30) {
          warningLevel = 'warning'
        }
      }
      
      return {
        domain_valid: true,
        expires_at: expirationDate ? expirationDate.toISOString() : null,
        days_until_expiry: daysUntilExpiry,
        registrar: registrar,
        name_servers: nameservers,
        warning_level: warningLevel,
        error_message: expirationDate ? null : 'Could not parse domain expiration date from WHOIS data'
      }
      
    } catch (whoisError: any) {
      // Fallback: if WHOIS fails, still return nameserver info
      return {
        domain_valid: nameservers.length > 0,
        expires_at: null,
        days_until_expiry: null,
        registrar: null,
        name_servers: nameservers,
        warning_level: 'none',
        error_message: `WHOIS lookup failed: ${whoisError.message}`
      }
    }
  } catch (error: any) {
    return {
      domain_valid: false,
      expires_at: null,
      days_until_expiry: null,
      registrar: null,
      name_servers: [],
      warning_level: 'critical',
      error_message: error.message || 'Domain check failed'
    }
  }
}

export async function checkPort(hostname: string, port: number, protocol: 'tcp' | 'udp' = 'tcp'): Promise<{
  status: 'open' | 'closed' | 'timeout' | 'error'
  response_time: number
  error_message: string | null
}> {
  const startTime = Date.now()
  
  return new Promise((resolve) => {
    if (protocol === 'udp') {
      // UDP port checking using dgram socket
      const dgram = require('dgram')
      const socket = dgram.createSocket('udp4')
      
      // Set timeout for UDP check
      const timeout = setTimeout(() => {
        socket.close()
        resolve({
          status: 'timeout',
          response_time: Date.now() - startTime,
          error_message: `UDP port ${port} timeout after 10 seconds`
        })
      }, 10000)
      
      socket.on('error', (error: any) => {
        clearTimeout(timeout)
        socket.close()
        
        // ECONNREFUSED typically means port is closed
        const status = error.code === 'ECONNREFUSED' ? 'closed' : 'error'
        resolve({
          status,
          response_time: Date.now() - startTime,
          error_message: error.message
        })
      })
      
      socket.on('message', (message: Buffer, remote: any) => {
        // Received a response - port is open
        clearTimeout(timeout)
        socket.close()
        resolve({
          status: 'open',
          response_time: Date.now() - startTime,
          error_message: null
        })
      })
      
      // Send a small UDP packet to test the port
      const testMessage = Buffer.from('test')
      socket.send(testMessage, port, hostname, (error: any) => {
        if (error) {
          clearTimeout(timeout)
          socket.close()
          resolve({
            status: 'error',
            response_time: Date.now() - startTime,
            error_message: error.message
          })
        }
        // For UDP, we don't get immediate feedback, so we wait for either:
        // 1. A response message (port is open and service responds)
        // 2. An ICMP error (port is closed)
        // 3. Timeout (port may be open but service doesn't respond, or filtered)
      })
      
      return
    }

    const net = require('net')
    const socket = new net.Socket()
    
    socket.setTimeout(10000)
    
    socket.on('connect', () => {
      socket.destroy()
      resolve({
        status: 'open',
        response_time: Date.now() - startTime,
        error_message: null
      })
    })
    
    socket.on('timeout', () => {
      socket.destroy()
      resolve({
        status: 'timeout',
        response_time: Date.now() - startTime,
        error_message: 'Connection timeout'
      })
    })
    
    socket.on('error', (error: any) => {
      socket.destroy()
      const status = error.code === 'ECONNREFUSED' ? 'closed' : 'error'
      resolve({
        status,
        response_time: Date.now() - startTime,
        error_message: error.message
      })
    })
    
    socket.connect(port, hostname)
  })
}

export function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return url // If it's already just a domain
  }
}

export function extractPortFromUrl(url: string): number {
  try {
    const urlObj = new URL(url)
    if (urlObj.port) {
      return parseInt(urlObj.port)
    }
    return urlObj.protocol === 'https:' ? 443 : 80
  } catch {
    return 443 // Default to HTTPS
  }
}