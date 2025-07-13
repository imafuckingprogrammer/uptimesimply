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
    // Use a WHOIS API service (you'll need to sign up for one)
    // For now, we'll use a simple DNS lookup to get nameservers
    const dns = require('dns').promises
    
    try {
      const nameservers = await dns.resolveNs(domain)
      
      // In a real implementation, you'd use a WHOIS API like:
      // - whoisjsonapi.com (free tier)
      // - whois.whoisxmlapi.com 
      // - ip2whois.com
      
      // For demo purposes, we'll return a placeholder
      return {
        domain_valid: true,
        expires_at: null, // Would get from WHOIS API
        days_until_expiry: null,
        registrar: null, // Would get from WHOIS API
        name_servers: nameservers,
        warning_level: 'none',
        error_message: 'Domain expiration check requires WHOIS API integration'
      }
    } catch (error: any) {
      return {
        domain_valid: false,
        expires_at: null,
        days_until_expiry: null,
        registrar: null,
        name_servers: [],
        warning_level: 'critical',
        error_message: error.message || 'Domain lookup failed'
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
      // UDP port checking is more complex and often unreliable
      resolve({
        status: 'error',
        response_time: Date.now() - startTime,
        error_message: 'UDP port checking not implemented yet'
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