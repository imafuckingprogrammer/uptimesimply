// Date utilities to prevent hydration errors by ensuring consistent formatting

import { useState, useEffect } from 'react'

// Custom hook to prevent hydration errors with date formatting
export function useClientDate() {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  return isClient
}

// Format date consistently for server and client
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  // Use a consistent format that works on both server and client
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false, // Use 24-hour format to avoid AM/PM inconsistencies
    timeZone: 'UTC' // Use UTC to avoid timezone inconsistencies
  }

  return dateObj.toLocaleDateString('en-GB', { ...defaultOptions, ...options })
}

// Format for timestamps (more precise)
export function formatTimestamp(date: string | Date): string {
  return formatDate(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Format for display (user-friendly)
export function formatDisplayDate(date: string | Date): string {
  return formatDate(date, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Safe date component that prevents hydration errors
interface SafeDateProps {
  date: string | Date
  format?: 'full' | 'display' | 'timestamp'
  className?: string
}

export function SafeDate({ date, format = 'display', className }: SafeDateProps) {
  const isClient = useClientDate()
  
  if (!isClient) {
    // Return a placeholder during SSR
    return <span className={className}>--</span>
  }

  const formatters = {
    full: formatDate,
    display: formatDisplayDate,
    timestamp: formatTimestamp
  }

  return <span className={className}>{formatters[format](date)}</span>
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - dateObj.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  
  return formatDisplayDate(date)
}