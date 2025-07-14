import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Get the session
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Define protected routes - routes that require authentication
  const protectedRoutes = [
    '/settings',
    '/billing',
    '/monitors',
    '/incidents',
    '/profile'
  ]

  // Define auth routes - routes that should redirect to dashboard if already logged in
  const authRoutes = [
    '/auth/login',
    '/auth/signup',
    '/auth/forgot-password'
  ]

  const pathname = req.nextUrl.pathname

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  
  // Check if the current path is an auth route
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))

  // If user is trying to access a protected route without being authenticated
  if (isProtectedRoute && !session) {
    const redirectUrl = new URL('/auth/login', req.url)
    // Store the intended destination to redirect after login
    redirectUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // If user is logged in and trying to access auth pages, redirect to demo (dashboard)
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/demo', req.url))
  }

  // For API routes that need authentication
  if (pathname.startsWith('/api/') && pathname !== '/api/cron/check-websites') {
    // Allow certain public API routes
    const publicApiRoutes = [
      '/api/auth/',
      '/api/demo/'
    ]
    
    const isPublicApiRoute = publicApiRoutes.some(route => pathname.startsWith(route))
    
    if (!isPublicApiRoute && !session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}