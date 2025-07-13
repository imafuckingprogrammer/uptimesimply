'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Globe, MapPin, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'

interface LocationCheck {
  location: string
  status: string
  response_time?: number
  status_code?: number
  error_message?: string
  checked_at: string
}

interface MonitoringLocationsProps {
  monitorId: string
  className?: string
}

const LOCATION_INFO = {
  'us-east': { name: 'US East', flag: '🇺🇸', region: 'North America' },
  'us-west': { name: 'US West', flag: '🇺🇸', region: 'North America' },
  'europe': { name: 'Europe', flag: '🇪🇺', region: 'Europe' },
  'asia-pacific': { name: 'Asia Pacific', flag: '🌏', region: 'Asia Pacific' },
  'south-america': { name: 'South America', flag: '🌎', region: 'South America' }
}

export function MonitoringLocations({ monitorId, className }: MonitoringLocationsProps) {
  const [locations, setLocations] = useState<LocationCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLocationData()
    // Refresh every 30 seconds
    const interval = setInterval(fetchLocationData, 30000)
    return () => clearInterval(interval)
  }, [monitorId])

  const fetchLocationData = async () => {
    try {
      const response = await fetch(`/api/monitors/${monitorId}/locations`)
      if (!response.ok) {
        throw new Error('Failed to fetch location data')
      }
      const data = await response.json()
      setLocations(data.locations || [])
      setError(null)
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching location data:', err)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'down':
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'timeout':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'up':
        return <Badge variant="success" className="text-xs">Online</Badge>
      case 'down':
        return <Badge variant="destructive" className="text-xs">Down</Badge>
      case 'timeout':
        return <Badge variant="warning" className="text-xs">Timeout</Badge>
      case 'error':
        return <Badge variant="destructive" className="text-xs">Error</Badge>
      default:
        return <Badge variant="outline" className="text-xs">Unknown</Badge>
    }
  }

  const formatResponseTime = (time?: number) => {
    if (!time) return '-'
    if (time < 1000) return `${time}ms`
    return `${(time / 1000).toFixed(1)}s`
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Monitoring Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground">
            Loading location data...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Monitoring Locations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-600">
            Error loading location data: {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Monitoring Locations
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Global monitoring from {Object.keys(LOCATION_INFO).length} locations
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(LOCATION_INFO).map(([locationKey, info]) => {
            const locationData = locations.find(l => l.location === locationKey)
            
            return (
              <div
                key={locationKey}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(locationData?.status || 'unknown')}
                    <span className="text-lg">{info.flag}</span>
                  </div>
                  <div>
                    <div className="font-medium">{info.name}</div>
                    <div className="text-xs text-muted-foreground">{info.region}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {locationData?.response_time && (
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {formatResponseTime(locationData.response_time)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {locationData.status_code && `HTTP ${locationData.status_code}`}
                      </div>
                    </div>
                  )}
                  {getStatusBadge(locationData?.status || 'unknown')}
                </div>
              </div>
            )
          })}
        </div>
        
        {locations.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              Last checked: {new Date(locations[0]?.checked_at).toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Status determined by majority consensus ({Math.ceil(Object.keys(LOCATION_INFO).length / 2)}+ locations must agree)
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}