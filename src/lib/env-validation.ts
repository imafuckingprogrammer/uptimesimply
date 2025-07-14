// Environment variable validation utility

export interface EnvConfig {
  required: string[]
  optional?: string[]
}

export interface ValidationResult {
  isValid: boolean
  missing: string[]
  warnings: string[]
}

/**
 * Validates environment variables
 */
export function validateEnvironment(config: EnvConfig): ValidationResult {
  const missing: string[] = []
  const warnings: string[] = []

  // Check required environment variables
  for (const varName of config.required) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }

  // Check optional environment variables and warn if missing
  if (config.optional) {
    for (const varName of config.optional) {
      if (!process.env[varName]) {
        warnings.push(`Optional environment variable ${varName} is not set`)
      }
    }
  }

  return {
    isValid: missing.length === 0,
    missing,
    warnings
  }
}

/**
 * Validates and throws error if required environment variables are missing
 */
export function requireEnvironmentVariables(config: EnvConfig): void {
  const result = validateEnvironment(config)
  
  if (!result.isValid) {
    throw new Error(
      `Missing required environment variables: ${result.missing.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    )
  }

  // Log warnings for missing optional variables
  if (result.warnings.length > 0) {
    console.warn('Environment warnings:', result.warnings.join('; '))
  }
}

/**
 * Get environment variable with default value
 */
export function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name]
  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue
    }
    throw new Error(`Environment variable ${name} is required but not set`)
  }
  return value
}

/**
 * Get environment variable as number
 */
export function getEnvNumber(name: string, defaultValue?: number): number {
  const value = process.env[name]
  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue
    }
    throw new Error(`Environment variable ${name} is required but not set`)
  }
  
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a valid number, got: ${value}`)
  }
  
  return parsed
}

/**
 * Get environment variable as boolean
 */
export function getEnvBoolean(name: string, defaultValue?: boolean): boolean {
  const value = process.env[name]
  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue
    }
    throw new Error(`Environment variable ${name} is required but not set`)
  }
  
  const lowercaseValue = value.toLowerCase()
  if (lowercaseValue === 'true' || lowercaseValue === '1' || lowercaseValue === 'yes') {
    return true
  } else if (lowercaseValue === 'false' || lowercaseValue === '0' || lowercaseValue === 'no') {
    return false
  } else {
    throw new Error(`Environment variable ${name} must be a boolean value, got: ${value}`)
  }
}

// Common environment configurations
export const COMMON_ENV_CONFIGS = {
  supabase: {
    required: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as string[],
    optional: ['SUPABASE_SERVICE_ROLE_KEY'] as string[]
  },
  
  twilio: {
    required: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'] as string[],
    optional: [] as string[]
  },
  
  email: {
    required: ['EMAIL_FROM'] as string[],
    optional: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'] as string[]
  },
  
  app: {
    required: ['NEXT_PUBLIC_APP_URL'] as string[],
    optional: ['CRON_SECRET', 'NODE_ENV'] as string[]
  },
  
  ssl: {
    required: [] as string[],
    optional: ['SSL_LABS_API_URL'] as string[]
  }
}

/**
 * Validates all common environment variables
 */
export function validateAllEnvironmentVariables(): ValidationResult {
  const allRequired: string[] = []
  const allOptional: string[] = []
  
  // Collect all required and optional variables
  Object.values(COMMON_ENV_CONFIGS).forEach(config => {
    allRequired.push(...config.required)
    allOptional.push(...config.optional)
  })
  
  return validateEnvironment({
    required: Array.from(new Set(allRequired)), // Remove duplicates
    optional: Array.from(new Set(allOptional))
  })
}