// DEPRECATED: Use ssl-unified.ts instead
// This file is kept for backward compatibility but will be removed
// Simpler SSL monitoring using HTTPS requests
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
  try {
    // Use fetch with HTTPS to get certificate info
    const url = `https://${hostname}${port !== 443 ? `:${port}` : ''}`
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      
      // For now, we'll do a basic check - certificate is valid if HTTPS works
      // In production, you'd use a service like SSL Labs API or similar
      return {
        certificate_valid: response.ok || response.status < 500,
        expires_at: null, // Would need SSL Labs API or similar
        days_until_expiry: null,
        issuer: null,
        algorithm: null,
        key_size: null,
        san_domains: [],
        warning_level: 'none',
        error_message: response.ok ? null : `HTTPS check failed: ${response.status}`
      }
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      if (fetchError.name === 'AbortError') {
        return {
          certificate_valid: false,
          expires_at: null,
          days_until_expiry: null,
          issuer: null,
          algorithm: null,
          key_size: null,
          san_domains: [],
          warning_level: 'critical',
          error_message: 'SSL connection timeout'
        }
      }
      
      // Check if it's an SSL-related error
      const isSSLError = fetchError.message.includes('certificate') || 
                        fetchError.message.includes('SSL') ||
                        fetchError.message.includes('TLS') ||
                        fetchError.code === 'CERT_HAS_EXPIRED' ||
                        fetchError.code === 'CERT_UNTRUSTED'
      
      return {
        certificate_valid: false,
        expires_at: null,
        days_until_expiry: null,
        issuer: null,
        algorithm: null,
        key_size: null,
        san_domains: [],
        warning_level: isSSLError ? 'critical' : 'none',
        error_message: isSSLError ? `SSL Error: ${fetchError.message}` : null
      }
    }
  } catch (error: any) {
    return {
      certificate_valid: false,
      expires_at: null,
      days_until_expiry: null,
      issuer: null,
      algorithm: null,
      key_size: null,
      san_domains: [],
      warning_level: 'critical',
      error_message: `SSL check failed: ${error.message}`
    }
  }
}

export async function checkDomainExpiration(domain: string): Promise<DomainCheckResult> {
  try {
    const dns = require('dns').promises
    
    try {
      const nameservers = await dns.resolveNs(domain)
      
      return {
        domain_valid: true,
        expires_at: null, // Requires WHOIS API
        days_until_expiry: null,
        registrar: null, // Requires WHOIS API
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

export function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return url // If it's already just a domain
  }
}

export function extractRootDomain(hostname: string): string {
  // Remove common subdomains for domain expiration checks
  const parts = hostname.split('.')
  
  // If it's already a root domain (2 parts like "google.com"), return as-is
  if (parts.length <= 2) {
    return hostname
  }
  
  // Remove common subdomains like www, mail, api, etc.
  const commonSubdomains = ['www', 'mail', 'api', 'app', 'blog', 'shop', 'store', 'admin', 'portal']
  
  if (commonSubdomains.includes(parts[0].toLowerCase())) {
    // Remove the first subdomain
    return parts.slice(1).join('.')
  }
  
  // For other cases, assume it's a valid subdomain and keep as-is
  // (like subdomain.company.com where subdomain is meaningful)
  return hostname
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