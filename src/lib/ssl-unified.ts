// Unified SSL monitoring system - consolidates all SSL functionality
import * as tls from 'tls'
import { checkSSLCertificate as sslMonitoringCheck, checkDomainExpiration as domainCheck, type SSLCheckResult, type DomainCheckResult } from './ssl-monitoring'
import { analyzeSSLWithSSLLabs } from './ssl-labs'

// Re-export types for compatibility
export type { SSLCheckResult, DomainCheckResult }

// Enhanced SSL check result that includes SSL Labs data
export interface EnhancedSSLResult extends SSLCheckResult {
  ssl_labs_grade?: string
  ssl_labs_errors?: string[]
  ssl_labs_warnings?: string[]
  performance_score?: number
}

// Unified SSL certificate checking function
export async function checkSSLCertificate(hostname: string, port: number = 443): Promise<EnhancedSSLResult> {
  try {
    // Primary SSL check using our comprehensive monitoring
    const basicResult = await sslMonitoringCheck(hostname, port)
    
    // Enhanced result with potential SSL Labs data
    const enhancedResult: EnhancedSSLResult = { ...basicResult }
    
    // Add SSL Labs analysis if certificate is valid and we're not rate limited
    if (basicResult.certificate_valid) {
      try {
        const sslLabsResult = await analyzeSSLWithSSLLabs(hostname)
        if (sslLabsResult.success && sslLabsResult.grade) {
          enhancedResult.ssl_labs_grade = sslLabsResult.grade
          enhancedResult.ssl_labs_errors = sslLabsResult.errors || []
          enhancedResult.ssl_labs_warnings = sslLabsResult.warnings || []
          
          // Convert grade to performance score
          const gradeToScore: Record<string, number> = {
            'A+': 100, 'A': 90, 'A-': 85, 'B': 75, 'C': 65, 'D': 55, 'E': 45, 'F': 25, 'T': 0
          }
          enhancedResult.performance_score = gradeToScore[sslLabsResult.grade] || 0
        }
      } catch (sslLabsError) {
        // SSL Labs is optional - don't fail the entire check
        console.warn('SSL Labs check failed (non-critical):', sslLabsError)
      }
    }
    
    return enhancedResult
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
      error_message: error.message || 'SSL check failed'
    }
  }
}

// Unified domain expiration checking
export async function checkDomainExpiration(domain: string): Promise<DomainCheckResult> {
  return domainCheck(domain)
}

// Browser-compatible SSL check (simplified)
export async function checkSSLInBrowser(url: string): Promise<SSLCheckResult> {
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      signal: AbortSignal.timeout(10000)
    })
    
    // Basic validation - if HTTPS request succeeds, certificate is likely valid
    const isValid = response.ok && url.startsWith('https://')
    
    return {
      certificate_valid: isValid,
      expires_at: null, // Can't get cert details in browser
      days_until_expiry: null,
      issuer: null,
      algorithm: null,
      key_size: null,
      san_domains: [],
      warning_level: isValid ? 'none' : 'critical',
      error_message: isValid ? null : 'SSL validation failed in browser'
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
      error_message: error.message || 'SSL check failed'
    }
  }
}

// Utility functions
export function extractDomainFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`)
    return parsedUrl.hostname
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0].split(':')[0]
  }
}

export function extractRootDomain(hostname: string): string {
  const parts = hostname.split('.')
  if (parts.length <= 2) return hostname
  return parts.slice(-2).join('.')
}

export function extractPortFromUrl(url: string): number {
  try {
    const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`)
    return parsedUrl.port ? parseInt(parsedUrl.port) : (parsedUrl.protocol === 'https:' ? 443 : 80)
  } catch {
    return 443
  }
}

// For compatibility with existing imports
export const updateMonitorSSLInfo = async (monitorId: string, hostname: string): Promise<void> => {
  try {
    const sslResult = await checkSSLCertificate(hostname)
    console.log(`SSL info updated for monitor ${monitorId}:`, sslResult)
  } catch (error) {
    console.error(`Failed to update SSL info for monitor ${monitorId}:`, error)
  }
}