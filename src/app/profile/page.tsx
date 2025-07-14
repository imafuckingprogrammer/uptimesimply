'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/ui/loader'
import { 
  User, 
  Calendar, 
  CreditCard, 
  Settings, 
  Shield,
  CheckCircle,
  AlertTriangle,
  ExternalLink
} from 'lucide-react'
import { getTrialDaysRemaining, hasActiveSubscription, isOnTrial } from '@/lib/auth'

export default function ProfilePage() {
  const { user, loading, refreshUser } = useAuth()
  const [isUpdating, setIsUpdating] = useState(false)
  const [email, setEmail] = useState('')

  useEffect(() => {
    if (user) {
      setEmail(user.email)
    }
  }, [user])

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdating(true)
    
    try {
      // Update email logic would go here
      console.log('Updating profile...')
      await refreshUser()
    } catch (error) {
      console.error('Failed to update profile:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  if (loading) {
    return <LoadingState size="lg" fullScreen />
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please Log In</h1>
          <p className="text-gray-600">You need to be logged in to view your profile.</p>
        </div>
      </div>
    )
  }

  const trialDaysRemaining = getTrialDaysRemaining(user)
  const onTrial = isOnTrial(user)
  const hasSubscription = hasActiveSubscription(user)

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Profile</h1>
          <p className="text-gray-600">Manage your account settings and subscription</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Information */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isUpdating}
                    />
                  </div>

                  <div>
                    <Label>Account Created</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {new Date(user.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? 'Updating...' : 'Update Profile'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Two-Factor Authentication</span>
                  </div>
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    Enabled via Supabase
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Password</h4>
                    <p className="text-sm text-gray-600">Change your account password</p>
                  </div>
                  <Button variant="outline" size="sm">
                    Change Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Subscription Sidebar */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Current Plan */}
                  <div>
                    <Label className="text-sm font-medium">Current Plan</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {onTrial ? (
                        <Badge variant="outline" className="text-blue-700 border-blue-300">
                          Free Trial
                        </Badge>
                      ) : hasSubscription ? (
                        <Badge className="bg-green-600">
                          {user.subscription_status === 'active' ? 'Pro Plan' : user.subscription_status}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-700">
                          Free Plan
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Trial Information */}
                  {onTrial && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">
                          Trial Ends Soon
                        </span>
                      </div>
                      <p className="text-sm text-blue-700">
                        {trialDaysRemaining} days remaining
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        Upgrade to continue using all features
                      </p>
                    </div>
                  )}

                  {/* Plan Limits */}
                  <div>
                    <Label className="text-sm font-medium">Plan Limits</Label>
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Monitors</span>
                        <span className="font-medium">
                          {onTrial || hasSubscription ? '50' : '5'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Check Interval</span>
                        <span className="font-medium">
                          {onTrial || hasSubscription ? '1 minute' : '5 minutes'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">SSL Monitoring</span>
                        <span className="font-medium">
                          {onTrial || hasSubscription ? '✓' : '✗'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Status Pages</span>
                        <span className="font-medium">
                          {onTrial || hasSubscription ? '✓' : '✗'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2">
                    {!hasSubscription && (
                      <Button className="w-full" size="sm">
                        Upgrade to Pro
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Button>
                    )}
                    
                    {hasSubscription && (
                      <Button variant="outline" className="w-full" size="sm">
                        Manage Billing
                        <ExternalLink className="ml-2 h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Usage Stats */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Usage This Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Monitors Created</span>
                    <span className="font-medium">0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Checks Performed</span>
                    <span className="font-medium">0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Alerts Sent</span>
                    <span className="font-medium">0</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}