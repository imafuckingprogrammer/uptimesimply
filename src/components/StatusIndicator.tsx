'use client'

import { cn, getStatusColor, getStatusDot } from '@/lib/utils'

interface StatusIndicatorProps {
  status: 'up' | 'down' | 'unknown'
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export function StatusIndicator({ status, size = 'md', showText = true }: StatusIndicatorProps) {
  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3', 
    lg: 'w-4 h-4'
  }

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  return (
    <div className="flex items-center gap-2">
      <div 
        className={cn(
          'rounded-full',
          dotSizes[size],
          getStatusDot(status)
        )}
      />
      {showText && (
        <span className={cn(
          'font-medium capitalize',
          textSizes[size],
          status === 'up' ? 'text-green-600' : 
          status === 'down' ? 'text-red-600' : 
          'text-gray-600'
        )}>
          {status}
        </span>
      )}
    </div>
  )
}