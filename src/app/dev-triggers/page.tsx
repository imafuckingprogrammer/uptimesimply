'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'

export default function DevTriggersPage() {
  const [loading, setLoading] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, any>>({})

  const triggerCron = async (endpoint: string, name: string) => {
    setLoading(endpoint)
    try {
      const response = await fetch(`/api/cron/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const result = await response.json()
      setResults(prev => ({ ...prev, [endpoint]: result }))
    } catch (error: any) {
      setResults(prev => ({ 
        ...prev, 
        [endpoint]: { 
          error: error.message || 'Failed to trigger cron job' 
        } 
      }))
    } finally {
      setLoading(null)
    }
  }

  const cronJobs = [
    { endpoint: 'check-websites', name: 'Check Websites', description: 'Check all website monitors' },
    { endpoint: 'check-ssl', name: 'Check SSL', description: 'Check SSL certificates and domain expiration' },
    { endpoint: 'check-heartbeats', name: 'Check Heartbeats', description: 'Check heartbeat monitors' },
    { endpoint: 'check-sla', name: 'Check SLA', description: 'Calculate SLA metrics' }
  ]

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Development Triggers</h1>
          <p className="text-gray-600">
            Manually trigger cron jobs for testing in development mode.
          </p>
          <Badge variant="outline" className="mt-2">
            Development Only
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cronJobs.map((job) => (
            <Card key={job.endpoint}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {job.name}
                  {results[job.endpoint] && (
                    results[job.endpoint].error ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )
                  )}
                </CardTitle>
                <p className="text-sm text-gray-600">{job.description}</p>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => triggerCron(job.endpoint, job.name)}
                  disabled={loading === job.endpoint}
                  className="w-full mb-4"
                >
                  {loading === job.endpoint ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Triggering...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Trigger {job.name}
                    </>
                  )}
                </Button>

                {results[job.endpoint] && (
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Result:</h4>
                    <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                      {JSON.stringify(results[job.endpoint], null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800">Development Note</span>
          </div>
          <p className="text-xs text-yellow-700">
            This page is only for development. In production, these cron jobs should be triggered by your hosting platform's cron scheduler (Vercel Cron, etc.) or external services like GitHub Actions.
          </p>
        </div>
      </div>
    </div>
  )
}