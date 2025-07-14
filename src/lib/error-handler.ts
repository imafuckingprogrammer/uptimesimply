// Standardized error handling utilities

export interface StandardError {
  message: string
  code?: string
  status?: number
  details?: unknown
  timestamp: string
}

export interface APIErrorResponse {
  error: string
  code?: string
  details?: unknown
  timestamp: string
}

/**
 * Standard error logger with consistent format
 */
export function logError(error: unknown, context?: string): StandardError {
  const timestamp = new Date().toISOString()
  const errorMessage = error instanceof Error ? error.message : String(error)
  const contextPrefix = context ? `[${context}] ` : ''
  
  const standardError: StandardError = {
    message: errorMessage,
    code: error instanceof Error ? error.name : 'UnknownError',
    timestamp,
    details: error instanceof Error ? { stack: error.stack } : error
  }
  
  console.error(`${contextPrefix}${errorMessage}`, {
    error: standardError,
    timestamp
  })
  
  return standardError
}

/**
 * Handle API errors with consistent response format
 */
export function handleAPIError(error: unknown, context?: string): APIErrorResponse {
  const standardError = logError(error, context)
  
  return {
    error: standardError.message,
    code: standardError.code,
    details: process.env.NODE_ENV === 'development' ? standardError.details : undefined,
    timestamp: standardError.timestamp
  }
}

/**
 * Create standardized error responses for Next.js API routes
 */
export function createErrorResponse(error: unknown, status: number = 500, context?: string) {
  const errorResponse = handleAPIError(error, context)
  
  // Map common error types to appropriate status codes
  if (status === 500 && error instanceof Error) {
    if (error.message.includes('not found') || error.message.includes('Not found')) {
      status = 404
    } else if (error.message.includes('unauthorized') || error.message.includes('Unauthorized')) {
      status = 401
    } else if (error.message.includes('forbidden') || error.message.includes('Forbidden')) {
      status = 403
    } else if (error.message.includes('validation') || error.message.includes('invalid')) {
      status = 400
    }
  }
  
  return Response.json(errorResponse, { status })
}

/**
 * Wrapper for async operations with standardized error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<{ success: true; data: T } | { success: false; error: StandardError }> {
  try {
    const data = await operation()
    return { success: true, data }
  } catch (error) {
    const standardError = logError(error, context)
    return { success: false, error: standardError }
  }
}

/**
 * Retry operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    context?: string
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000, context } = options
  
  let lastError: unknown
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      
      if (attempt === maxRetries) {
        logError(error, `${context} - Final attempt ${attempt} failed`)
        throw error
      }
      
      const delay = Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay)
      logError(error, `${context} - Attempt ${attempt} failed, retrying in ${delay}ms`)
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}

/**
 * Validate required fields with standardized error messages
 */
export function validateRequired(data: Record<string, unknown>, fields: string[]): void {
  const missing = fields.filter(field => !data[field])
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`)
  }
}

/**
 * Safe JSON parsing with error handling
 */
export function safeJSONParse<T>(jsonString: string, defaultValue: T, context?: string): T {
  try {
    return JSON.parse(jsonString) as T
  } catch (error) {
    logError(error, `${context} - JSON parse failed`)
    return defaultValue
  }
}

/**
 * Safe async operation wrapper for React components
 */
export function useSafeAsync<T>(
  operation: () => Promise<T>,
  dependencies: any[] = [],
  context?: string
) {
  return async () => {
    try {
      return await operation()
    } catch (error) {
      logError(error, context)
      throw error
    }
  }
}

/**
 * Database operation error handler
 */
export function handleDatabaseError(error: unknown, operation: string): never {
  const message = error instanceof Error ? error.message : String(error)
  
  if (message.includes('duplicate key') || message.includes('unique constraint')) {
    throw new Error(`Duplicate entry - ${operation} failed due to existing record`)
  } else if (message.includes('foreign key') || message.includes('constraint')) {
    throw new Error(`Invalid reference - ${operation} failed due to constraint violation`)
  } else if (message.includes('not found') || message.includes('no rows')) {
    throw new Error(`Record not found - ${operation} failed`)
  } else {
    throw new Error(`Database error - ${operation} failed: ${message}`)
  }
}

/**
 * Network operation error handler
 */
export function handleNetworkError(error: unknown, operation: string): never {
  const message = error instanceof Error ? error.message : String(error)
  
  if (message.includes('timeout') || message.includes('TIMEOUT')) {
    throw new Error(`Request timeout - ${operation} took too long to complete`)
  } else if (message.includes('network') || message.includes('fetch')) {
    throw new Error(`Network error - ${operation} failed due to connectivity issues`)
  } else if (message.includes('abort') || message.includes('ABORT')) {
    throw new Error(`Request cancelled - ${operation} was aborted`)
  } else {
    throw new Error(`Connection error - ${operation} failed: ${message}`)
  }
}