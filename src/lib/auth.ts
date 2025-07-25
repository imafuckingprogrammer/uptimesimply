// Authentication utilities and helpers for Supabase Auth
import { supabase } from '@/lib/supabase-client'
import type { User, Session } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string
  created_at: string
  subscription_status: string
  trial_ends_at: string
}

// Sign up new user
export async function signUp(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })

    if (error) {
      return { success: false, error: error.message }
    }

    // If user is created and we have a session, ensure profile exists
    if (data.user && data.session) {
      try {
        // Check if profile exists
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', data.user.id)
          .single()

        // If no profile exists, create one
        if (!existingProfile) {
          const profileData = {
            id: data.user.id,
            email: data.user.email!,
            created_at: data.user.created_at || new Date().toISOString(),
            subscription_status: 'trial',
            trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          }

          await supabase
            .from('profiles')
            .insert(profileData)
        }
      } catch (profileError) {
        console.warn('Profile creation during signup failed:', profileError)
        // Don't fail signup if profile creation fails - it will be created later
      }
    }

    if (data.user && !data.session) {
      return { 
        success: true, 
        message: 'Please check your email to confirm your account',
        user: data.user
      }
    }

    return { success: true, user: data.user, session: data.session }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Sign in existing user
export async function signIn(email: string, password: string) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, user: data.user, session: data.session }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Sign out user
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Get current session
export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, session }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Get current user with profile data
export async function getCurrentUser(): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return { success: false, error: authError?.message || 'No user found' }
    }

    // Get user profile from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // If profile doesn't exist, create it
    if (profileError && profileError.code === 'PGRST116') {
      console.log('Profile not found, creating new profile for user:', user.id)
      
      const newProfile = {
        id: user.id,
        email: user.email!,
        created_at: user.created_at || new Date().toISOString(),
        subscription_status: 'trial',
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      }

      const { data: createdProfile, error: createError } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .single()

      if (createError) {
        console.error('Failed to create profile:', createError)
        return { success: false, error: 'Failed to create user profile' }
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email!,
          created_at: createdProfile.created_at,
          subscription_status: createdProfile.subscription_status,
          trial_ends_at: createdProfile.trial_ends_at
        }
      }
    }

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      return { success: false, error: 'Failed to fetch user profile' }
    }

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email!,
        created_at: profile.created_at,
        subscription_status: profile.subscription_status,
        trial_ends_at: profile.trial_ends_at
      }
    }
  } catch (error: any) {
    console.error('getCurrentUser error:', error)
    return { success: false, error: error.message }
  }
}

// Reset password
export async function resetPassword(email: string) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, message: 'Password reset email sent' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Update password
export async function updatePassword(newPassword: string) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, message: 'Password updated successfully' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Check if user is on trial
export function isOnTrial(user: AuthUser): boolean {
  if (user.subscription_status !== 'trial') return false
  
  const trialEnds = new Date(user.trial_ends_at)
  const now = new Date()
  
  return trialEnds > now
}

// Get days remaining in trial
export function getTrialDaysRemaining(user: AuthUser): number {
  if (user.subscription_status !== 'trial') return 0
  
  const trialEnds = new Date(user.trial_ends_at)
  const now = new Date()
  const diffTime = trialEnds.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  return Math.max(0, diffDays)
}

// Check if user has active subscription
export function hasActiveSubscription(user: AuthUser): boolean {
  return ['active', 'trialing'].includes(user.subscription_status) || isOnTrial(user)
}