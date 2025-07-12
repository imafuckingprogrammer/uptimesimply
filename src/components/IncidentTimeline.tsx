'use client'

import { useState, useEffect } from 'react'
import { Incident } from '@/types'
import { formatDuration } from '@/lib/utils'
import { Loader } from '@/components/ui/loader'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'

interface IncidentTimelineProps {
  monitorId: string
  limit?: number
}

export function IncidentTimeline({ monitorId, limit = 10 }: IncidentTimelineProps) {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchIncidents()
  }, [monitorId])

  const fetchIncidents = async () => {
    try {
      const response = await fetch(`/api/monitors/${monitorId}/incidents?limit=${limit}`)
      const data = await response.json()
      setIncidents(data)
    } catch (error) {
      console.error('Failed to fetch incidents:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader size="md" />
      </div>
    )
  }

  if (incidents.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-green-700 mb-1">No incidents</h3>
        <p className="text-muted-foreground">This monitor has had no downtime incidents.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {incidents.map((incident, index) => (
        <div key={incident.id} className="relative">
          {/* Timeline line */}
          {index < incidents.length - 1 && (
            <div className="absolute left-4 top-8 w-0.5 h-full bg-gray-200" />
          )}
          
          <div className="flex items-start gap-4">
            {/* Status icon */}
            <div className="flex-shrink-0 mt-1">
              {incident.resolved ? (
                <CheckCircle className="h-8 w-8 text-green-500 bg-white rounded-full" />
              ) : (
                <AlertTriangle className="h-8 w-8 text-red-500 bg-white rounded-full" />
              )}
            </div>
            
            {/* Incident details */}
            <div className="flex-1 bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">
                  {incident.resolved ? 'Service Restored' : 'Service Disruption'}
                </h4>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  incident.resolved 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {incident.resolved ? 'Resolved' : 'Ongoing'}
                </span>
              </div>
              
              <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>Started: {new Date(incident.started_at).toLocaleString()}</span>
                </div>
                
                {incident.ended_at && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>Ended: {new Date(incident.ended_at).toLocaleString()}</span>
                  </div>
                )}
                
                {incident.duration_minutes && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-700">
                      Duration: {formatDuration(incident.duration_minutes)}
                    </span>
                  </div>
                )}
                
                {incident.cause && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                    <span className="font-medium">Cause:</span> {incident.cause}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}