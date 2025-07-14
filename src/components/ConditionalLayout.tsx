'use client'

import { usePathname } from 'next/navigation'
import { Header } from '@/components/Header'

interface ConditionalLayoutProps {
  children: React.ReactNode
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname()
  const isAuthPage = pathname?.startsWith('/auth')

  if (isAuthPage) {
    // For auth pages, render children directly without main wrapper
    return <>{children}</>
  }

  // For all other pages, use the standard layout with header and main wrapper
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {children}
      </main>
    </div>
  )
}