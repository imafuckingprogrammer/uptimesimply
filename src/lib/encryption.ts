// Encryption utility for sensitive data storage

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32 // 256 bits

/**
 * Get or generate encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  
  if (!key) {
    // In development, generate a warning
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️  ENCRYPTION_KEY not set - using default key for development only')
      return Buffer.from('dev-key-not-secure-32-chars-min', 'utf8').subarray(0, KEY_LENGTH)
    }
    throw new Error('ENCRYPTION_KEY environment variable is required in production')
  }
  
  // Convert hex string to buffer or use as UTF-8
  if (key.length === KEY_LENGTH * 2) {
    // Assume hex string
    return Buffer.from(key, 'hex')
  } else {
    // Use UTF-8 and pad/truncate to correct length
    return Buffer.from(key, 'utf8').subarray(0, KEY_LENGTH)
  }
}

/**
 * Encrypt sensitive data
 */
export function encryptData(plaintext: string): string {
  if (!plaintext) {
    return ''
  }
  
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(16) // 128-bit IV
    const cipher = crypto.createCipher(ALGORITHM, key)
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Get the authentication tag
    const tag = cipher.getAuthTag()
    
    // Combine IV + tag + encrypted data
    const combined = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted
    
    return combined
  } catch (error) {
    console.error('Encryption failed:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt sensitive data
 */
export function decryptData(encryptedData: string): string {
  if (!encryptedData) {
    return ''
  }
  
  try {
    const key = getEncryptionKey()
    const parts = encryptedData.split(':')
    
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }
    
    const iv = Buffer.from(parts[0], 'hex')
    const tag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]
    
    const decipher = crypto.createDecipher(ALGORITHM, key)
    decipher.setAuthTag(tag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Decryption failed:', error)
    throw new Error('Failed to decrypt data')
  }
}

/**
 * Check if data appears to be encrypted
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false
  
  // Check for our encryption format (hex:hex:hex)
  const parts = data.split(':')
  return parts.length === 3 && 
         parts.every(part => /^[0-9a-f]+$/i.test(part))
}

/**
 * Encrypt sensitive monitor data
 */
export function encryptMonitorSecrets(monitor: any): any {
  const encryptedMonitor = { ...monitor }
  
  // List of fields that should be encrypted
  const sensitiveFields = [
    'auth_password',
    'auth_token',
    'slack_webhook_url',
    'discord_webhook_url',
    'webhook_url',
    'alert_sms' // Phone numbers are PII
  ]
  
  for (const field of sensitiveFields) {
    if (encryptedMonitor[field] && typeof encryptedMonitor[field] === 'string') {
      // Only encrypt if not already encrypted
      if (!isEncrypted(encryptedMonitor[field])) {
        encryptedMonitor[field] = encryptData(encryptedMonitor[field])
      }
    }
  }
  
  return encryptedMonitor
}

/**
 * Decrypt sensitive monitor data
 */
export function decryptMonitorSecrets(monitor: any): any {
  const decryptedMonitor = { ...monitor }
  
  // List of fields that should be decrypted
  const sensitiveFields = [
    'auth_password',
    'auth_token',
    'slack_webhook_url',
    'discord_webhook_url',
    'webhook_url',
    'alert_sms'
  ]
  
  for (const field of sensitiveFields) {
    if (decryptedMonitor[field] && typeof decryptedMonitor[field] === 'string') {
      // Only decrypt if encrypted
      if (isEncrypted(decryptedMonitor[field])) {
        try {
          decryptedMonitor[field] = decryptData(decryptedMonitor[field])
        } catch (error) {
          console.error(`Failed to decrypt ${field}:`, error)
          // Leave encrypted value as-is if decryption fails
        }
      }
    }
  }
  
  return decryptedMonitor
}

/**
 * Generate a new encryption key (for initial setup)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex')
}

/**
 * Validate encryption key format
 */
export function validateEncryptionKey(key: string): boolean {
  if (!key) return false
  
  // Check if it's a hex string of correct length
  if (key.length === KEY_LENGTH * 2 && /^[0-9a-f]+$/i.test(key)) {
    return true
  }
  
  // Check if it's a UTF-8 string of sufficient length
  if (key.length >= KEY_LENGTH) {
    return true
  }
  
  return false
}