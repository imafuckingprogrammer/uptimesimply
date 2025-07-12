import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatUptime(percentage: number | null): string {
  if (percentage === null) return '--'
  return `${percentage.toFixed(2)}%`
}

export function formatResponseTime(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'up':
      return 'text-green-600 bg-green-100'
    case 'down':
      return 'text-red-600 bg-red-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

export function getStatusDot(status: string): string {
  switch (status) {
    case 'up':
      return 'bg-green-500'
    case 'down':
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}