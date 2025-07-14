'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'
import { LoadingState } from '@/components/ui/loader'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, XCircle, Shield } from 'lucide-react'

function AuthCallbackForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const code = searchParams.get('code')
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        if (error) {
          setStatus('error')
          setMessage(errorDescription || error || 'Authentication failed')
          return
        }

        if (code) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          
          if (exchangeError) {
            setStatus('error')
            setMessage(exchangeError.message || 'Failed to authenticate')
            return
          }

          if (data.user) {
            setStatus('success')
            setMessage('Successfully authenticated! Redirecting...')
            
            // Redirect after a short delay
            setTimeout(() => {
              router.push('/')
            }, 2000)
            return
          }
        }

        // If we get here, something unexpected happened
        setStatus('error')
        setMessage('Invalid authentication callback')
      } catch (error: any) {
        console.error('Auth callback error:', error)
        setStatus('error')
        setMessage(error.message || 'An unexpected error occurred')
      }
    }

    handleAuthCallback()
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">SimpleUptime</h1>
          </div>
        </div>

        <Card className="shadow-xl border-0">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              {status === 'loading' && (
                <>
                  <LoadingState size="md" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Authenticating...</h3>
                    <p className="text-gray-600 text-sm">Please wait while we sign you in.</p>
                  </div>
                </>
              )}

              {status === 'success' && (
                <>
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-green-900 mb-2">Welcome to SimpleUptime!</h3>
                    <p className="text-green-700 text-sm">{message}</p>
                  </div>
                </>
              )}

              {status === 'error' && (
                <>
                  <div className="flex items-center justify-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                      <XCircle className="h-8 w-8 text-red-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-red-900 mb-2">Authentication Failed</h3>
                    <p className="text-red-700 text-sm mb-4">{message}</p>
                    <div className="space-y-2">
                      <button
                        onClick={() => router.push('/auth/login')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={() => router.push('/')}
                        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-md transition-colors"
                      >
                        Continue as Demo
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {status === 'success' && (
          <div className="text-center mt-6">
            <p className="text-gray-600 text-sm">
              You'll be redirected to your dashboard automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingState size="lg" fullScreen />}>
      <AuthCallbackForm />
    </Suspense>
  )
}