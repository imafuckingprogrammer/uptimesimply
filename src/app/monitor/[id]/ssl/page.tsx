'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Monitor } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loader'
import { ArrowLeft, Shield, AlertTriangle, CheckCircle, XCircle, Clock, Key, Globe } from 'lucide-react'

interface SSLCheckData {
  id: string
  checked_at: string
  certificate_valid: boolean
  expires_at: string | null
  days_until_expiry: number | null
  issuer: string | null
  algorithm: string | null
  key_size: number | null
  san_domains: string[]
  grade: string | null
  has_warnings: boolean
  vulnerabilities: string[]
  warning_level: 'none' | 'warning' | 'critical'
  error_message: string | null
}

interface PageProps {
  params: { id: string }
}

export default function SSLDetailsPage({ params }: PageProps) {
  const router = useRouter()
  const [monitor, setMonitor] = useState<Monitor | null>(null)
  const [sslData, setSSLData] = useState<SSLCheckData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSSLData()
  }, [params.id])

  const fetchSSLData = async () => {
    try {
      // Get monitor details
      const monitorResponse = await fetch(`/api/monitors/${params.id}`)
      if (monitorResponse.ok) {
        const monitorData = await monitorResponse.json()
        setMonitor(monitorData)
      }

      // Get SSL check history
      const sslResponse = await fetch(`/api/monitors/${params.id}/ssl-history`)
      if (sslResponse.ok) {
        const sslHistory = await sslResponse.json()
        setSSLData(sslHistory)
      }
    } catch (error) {
      console.error('Failed to fetch SSL data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingState size="lg" fullScreen />
  }

  if (!monitor) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-muted-foreground">Monitor not found</h2>
        <Button onClick={() => router.push('/')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>
    )
  }

  const latestSSL = sslData[0]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => router.push(`/monitor/${params.id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Monitor
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold">SSL Certificate Details</h1>
              <p className="text-muted-foreground">{monitor.name} - {monitor.url}</p>
            </div>
          </div>
        </div>
      </div>

      {!monitor.ssl_enabled && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-yellow-800">SSL monitoring is disabled for this monitor</span>
            </div>
            <p className="text-yellow-700 mt-1">
              Enable SSL monitoring in the monitor settings to see detailed certificate information.
            </p>
          </CardContent>
        </Card>
      )}

      {monitor.ssl_enabled && latestSSL && (
        <>
          {/* SSL Grade & Status */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">SSL Grade</CardTitle>
              </CardHeader>
              <CardContent>
                {latestSSL.grade ? (
                  <div className={`text-3xl font-bold inline-flex px-3 py-1 rounded ${
                    latestSSL.grade.startsWith('A') ? 'bg-green-100 text-green-700' :
                    latestSSL.grade.startsWith('B') ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {latestSSL.grade}
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-gray-500">-</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Certificate Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {latestSSL.certificate_valid ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600" />
                  )}
                  <span className={`text-lg font-semibold ${
                    latestSSL.certificate_valid ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {latestSSL.certificate_valid ? 'Valid' : 'Invalid'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expires In</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span className={`text-lg font-semibold ${
                    latestSSL.days_until_expiry && latestSSL.days_until_expiry <= 7 ? 'text-red-600' : 
                    latestSSL.days_until_expiry && latestSSL.days_until_expiry <= 30 ? 'text-yellow-600' : 
                    'text-green-600'
                  }`}>
                    {latestSSL.days_until_expiry !== null ? `${latestSSL.days_until_expiry} days` : 'Unknown'}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Warnings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {latestSSL.has_warnings ? (
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <span className={`text-lg font-semibold ${
                    latestSSL.has_warnings ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {latestSSL.has_warnings ? 'Yes' : 'None'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Certificate Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Certificate Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">Issuer:</span>
                  <span className="ml-2">{latestSSL.issuer || 'Unknown'}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Algorithm:</span>
                  <span className="ml-2">{latestSSL.algorithm || 'Unknown'}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Key Size:</span>
                  <span className="ml-2">{latestSSL.key_size ? `${latestSSL.key_size} bits` : 'Unknown'}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">Expires:</span>
                  <span className="ml-2">
                    {latestSSL.expires_at 
                      ? new Date(latestSSL.expires_at).toLocaleDateString()
                      : 'Unknown'
                    }
                  </span>
                </div>
              </div>

              {latestSSL.san_domains && latestSSL.san_domains.length > 0 && (
                <div>
                  <span className="font-medium text-muted-foreground block mb-2">Subject Alternative Names:</span>
                  <div className="flex flex-wrap gap-2">
                    {latestSSL.san_domains.map((domain, index) => (
                      <span key={index} className="px-2 py-1 bg-gray-100 rounded text-sm">
                        {domain}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vulnerabilities */}
          {latestSSL.vulnerabilities && latestSSL.vulnerabilities.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  Security Vulnerabilities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {latestSSL.vulnerabilities.map((vuln, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-red-50 rounded">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-red-800">{vuln}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Status Message */}
          {latestSSL.error_message && latestSSL.error_message !== 'Ready' && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium text-yellow-800">SSL Check Warning</span>
                </div>
                <p className="text-yellow-700 mt-1">{latestSSL.error_message}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {monitor.ssl_enabled && sslData.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No SSL data available yet
              </h3>
              <p className="text-muted-foreground">
                SSL monitoring is enabled but no checks have been performed yet. 
                The first SSL analysis will be available after the next scheduled check.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}