// Structured logging utility

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: string
  metadata?: Record<string, unknown>
  error?: Error
}

export class Logger {
  private context?: string
  public minLevel: LogLevel

  constructor(context?: string, minLevel: LogLevel = 'info') {
    this.context = context
    this.minLevel = minLevel
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    }
    return levels[level] >= levels[this.minLevel]
  }

  private formatLog(entry: LogEntry): string {
    const timestamp = entry.timestamp
    const level = entry.level.toUpperCase().padEnd(5)
    const context = entry.context ? `[${entry.context}] ` : ''
    const message = entry.message
    
    let formatted = `${timestamp} ${level} ${context}${message}`
    
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      formatted += ` | ${JSON.stringify(entry.metadata)}`
    }
    
    return formatted
  }

  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      metadata,
      error
    }

    const formatted = this.formatLog(entry)

    // In production, you might want to send to a logging service
    // For now, we'll use console but in a structured way
    switch (level) {
      case 'debug':
        console.debug(formatted, error)
        break
      case 'info':
        console.info(formatted, error)
        break
      case 'warn':
        console.warn(formatted, error)
        break
      case 'error':
        console.error(formatted, error)
        break
    }

    // In production, you could also send to external logging services here
    // await this.sendToExternalService(entry)
  }

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log('debug', message, metadata)
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata)
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata)
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata, error)
  }

  // Convenience methods for common patterns
  monitorCheck(monitorName: string, status: string, responseTime?: number): void {
    this.info(`Monitor check: ${monitorName}`, {
      status,
      responseTime,
      type: 'monitor_check'
    })
  }

  notification(channel: string, status: 'success' | 'failed', monitorName: string, error?: Error): void {
    const level = status === 'success' ? 'info' : 'warn'
    this.log(level, `Notification ${status}: ${channel} for ${monitorName}`, {
      channel,
      status,
      monitorName,
      type: 'notification'
    }, error)
  }

  apiRequest(method: string, path: string, status: number, duration?: number): void {
    const level = status >= 400 ? 'warn' : 'info'
    this.log(level, `${method} ${path} ${status}`, {
      method,
      path,
      status,
      duration,
      type: 'api_request'
    })
  }

  database(operation: string, table: string, success: boolean, error?: Error): void {
    const level = success ? 'debug' : 'error'
    this.log(level, `DB ${operation} on ${table}: ${success ? 'success' : 'failed'}`, {
      operation,
      table,
      success,
      type: 'database'
    }, error)
  }
}

// Global logger instances
export const logger = new Logger()
export const monitorLogger = new Logger('Monitor')
export const apiLogger = new Logger('API')
export const cronLogger = new Logger('Cron')
export const notificationLogger = new Logger('Notification')

// Helper function to create context-specific loggers
export function createLogger(context: string, minLevel: LogLevel = 'info'): Logger {
  return new Logger(context, minLevel)
}

// Environment-based configuration
export function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase() as LogLevel
  return level || (process.env.NODE_ENV === 'development' ? 'debug' : 'info')
}

// Initialize global logger with environment-based level
logger.minLevel = getLogLevel()
monitorLogger.minLevel = getLogLevel()
apiLogger.minLevel = getLogLevel()
cronLogger.minLevel = getLogLevel()
notificationLogger.minLevel = getLogLevel()