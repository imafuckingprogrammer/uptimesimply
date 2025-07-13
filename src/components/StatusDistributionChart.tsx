'use client'

import { useState, useEffect } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, CheckCircle, AlertTriangle, Activity } from 'lucide-react'

interface StatusData {
  name: string
  value: number
  percentage: number
  color: string
  icon: React.ComponentType<{ className?: string }>
}

interface StatusDistributionChartProps {
  monitorId: string
  period?: string
}

export function StatusDistributionChart({ monitorId, period = '7d' }: StatusDistributionChartProps) {
  const [data, setData] = useState<StatusData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/monitors/${monitorId}/status-distribution?period=${period}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch status distribution')
        }

        const result = await response.json()
        
        // Transform the data for the chart
        const statusData: StatusData[] = [
          {
            name: 'Online',
            value: result.online || 0,
            percentage: result.onlinePercentage || 0,
            color: '#16a34a',
            icon: CheckCircle
          },
          {
            name: 'Offline',
            value: result.offline || 0,
            percentage: result.offlinePercentage || 0,
            color: '#dc2626',
            icon: AlertTriangle
          },
          {
            name: 'Degraded',
            value: result.degraded || 0,
            percentage: result.degradedPercentage || 0,
            color: '#f59e0b',
            icon: Clock
          }
        ].filter(item => item.value > 0) // Only show categories with data

        setData(statusData)
      } catch (error: any) {
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [monitorId, period])

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: data.color }}
            />
            <span className="font-medium text-gray-900">{data.name}</span>
          </div>
          <p className="text-sm text-gray-600">
            {data.value} checks ({data.percentage.toFixed(1)}%)
          </p>
        </div>
      )
    }
    return null
  }

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload?.map((entry: any, index: number) => {
          const IconComponent = entry.payload.icon
          return (
            <div key={index} className="flex items-center gap-2">
              <IconComponent className={`h-4 w-4`} style={{ color: entry.color }} />
              <span className="text-sm text-gray-600">
                {entry.value}: {entry.payload.percentage.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            <p>Error loading status distribution: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Status Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-gray-500">
            <p>No status data available for this period</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Status Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
          {data.map((status, index) => {
            const IconComponent = status.icon
            return (
              <div key={index} className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <div 
                    className="h-4 w-4 rounded-full" 
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="text-sm font-medium" style={{ color: status.color }}>
                    {status.name}
                  </span>
                </div>
                <p className="text-xs text-gray-600">
                  {status.value} checks
                </p>
                <p className="text-lg font-bold" style={{ color: status.color }}>
                  {status.percentage.toFixed(1)}%
                </p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}