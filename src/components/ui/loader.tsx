import React from 'react'

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Loader({ size = 'md', className = '' }: LoaderProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6', 
    lg: 'h-8 w-8'
  }

  return (
    <div className={`animate-spin rounded-full border-2 border-muted border-t-primary ${sizeClasses[size]} ${className}`} />
  )
}

interface LoadingStateProps {
  message?: string
  size?: 'sm' | 'md' | 'lg'
  fullScreen?: boolean
}

export function LoadingState({ message, size = 'md', fullScreen = false }: LoadingStateProps) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <div className="text-center">
          <Loader size={size} className="mx-auto" />
          {message && (
            <p className="mt-3 text-sm text-muted-foreground">{message}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <Loader size={size} className="mx-auto" />
        {message && (
          <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  )
}