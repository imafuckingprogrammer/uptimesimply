'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { getTrialDaysRemaining, hasActiveSubscription } from '@/lib/auth'
import { 
  Shield, 
  User, 
  LogOut, 
  Settings, 
  CreditCard,
  ChevronDown,
  Clock
} from 'lucide-react'

export function Header() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [showUserMenu, setShowUserMenu] = useState(false)

  const isAuthPage = pathname?.startsWith('/auth')

  const handleSignOut = async () => {
    await signOut()
    setShowUserMenu(false)
    router.push('/')
  }

  if (isAuthPage) {
    return null // Don't show header on auth pages
  }

  const trialDays = user ? getTrialDaysRemaining(user) : 0
  const hasActiveSub = user ? hasActiveSubscription(user) : false

  return (
    <header className="border-b bg-card">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-primary">SimpleUptime</h1>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Navigation Links */}
            {user ? (
              <nav className="hidden md:flex items-center gap-6">
                <Link 
                  href="/demo" 
                  className={`text-sm font-medium hover:text-primary transition-colors ${
                    pathname === '/demo' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  Dashboard
                </Link>
                <Link 
                  href="/settings" 
                  className={`text-sm font-medium hover:text-primary transition-colors ${
                    pathname === '/settings' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  Settings
                </Link>
              </nav>
            ) : (
              <nav className="hidden md:flex items-center gap-6">
                <Link 
                  href="/demo" 
                  className={`text-sm font-medium hover:text-primary transition-colors ${
                    pathname === '/demo' ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  Demo
                </Link>
              </nav>
            )}
            
            {user ? (
              <div className="flex items-center gap-3">
                {/* Trial/Subscription Status */}
                {user.subscription_status === 'trial' && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md text-xs">
                    <Clock className="h-3 w-3" />
                    <span>{trialDays} days left</span>
                  </div>
                )}
                
                {hasActiveSub && user.subscription_status !== 'trial' && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-md text-xs">
                    <span>Pro</span>
                  </div>
                )}

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors"
                  >
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <span className="hidden md:block">{user.email}</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  
                  {showUserMenu && (
                    <>
                      {/* Backdrop */}
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowUserMenu(false)}
                      />
                      
                      {/* Dropdown Menu */}
                      <div className="absolute right-0 mt-2 w-56 bg-background border rounded-lg shadow-lg z-20">
                        <div className="py-1">
                          <div className="px-4 py-2 border-b">
                            <p className="text-sm font-medium truncate">{user.email}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {user.subscription_status} plan
                            </p>
                          </div>
                          
                          <Link
                            href="/demo"
                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors md:hidden"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <Shield className="h-4 w-4" />
                            Dashboard
                          </Link>
                          
                          <Link
                            href="/settings"
                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <Settings className="h-4 w-4" />
                            Account Settings
                          </Link>
                          
                          <Link
                            href="/billing"
                            className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
                            onClick={() => setShowUserMenu(false)}
                          >
                            <CreditCard className="h-4 w-4" />
                            Billing & Plans
                          </Link>
                          
                          <div className="border-t my-1" />
                          
                          <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth/signup">
                  <Button size="sm">
                    Start Free Trial
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}