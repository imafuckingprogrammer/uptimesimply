'use client'

import { useState, useEffect } from 'react'
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, Clock, Zap, AlertTriangle } from 'lucide-react'

interface PerformanceData {
  timestamp: string
  responseTime: number
  uptime: number
  incidents: number
  avgResponseTime: number
}

interface PerformanceTrendsChartProps {
  monitorId: string
}

export function PerformanceTrendsChart({ monitorId }: PerformanceTrendsChartProps) {
  const [data, setData] = useState<PerformanceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('7d')
  const [chartMode, setChartMode] = useState<'days' | 'hours'>('days')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // Determine chart mode based on period
        const mode = period === '1d' ? 'hours' : 'days'
        setChartMode(mode)
        
        const response = await fetch(`/api/monitors/${monitorId}/performance-trends?period=${period}&mode=${mode}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch performance trends')
        }

        const result = await response.json()
        setData(result.data || [])
      } catch (error: any) {
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [monitorId, period])

  const formatXAxisLabel = (value: string) => {
    const date = new Date(value)
    if (chartMode === 'hours') {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const date = new Date(label)
      const formattedDate = chartMode === 'hours' 
        ? date.toLocaleString()
        : date.toLocaleDateString()

      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="font-medium text-gray-900 mb-2">{formattedDate}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-600">{entry.name}:</span>
              <span className="font-medium">
                {entry.name === 'Response Time' || entry.name === 'Avg Response Time' 
                  ? `${entry.value}ms`
                  : entry.name === 'Uptime'
                  ? `${entry.value}%`
                  : entry.value
                }
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-80">
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
            <TrendingUp className="h-5 w-5" />
            Performance Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-80 text-gray-500">
            <p>Error loading performance trends: {error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Trends
          </CardTitle>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Today</SelectItem>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="14d">14 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={formatXAxisLabel}
                stroke="#64748b"
                fontSize={12}
              />
              <YAxis 
                yAxisId="left"
                orientation="left"
                stroke="#64748b"
                fontSize={12}
                label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                stroke="#64748b"
                fontSize={12}
                label={{ value: 'Uptime (%) / Incidents', angle: 90, position: 'insideRight' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              
              {/* Response Time Line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="responseTime"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2 }}
                name="Response Time"
              />
              
              {/* Average Response Time Line */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="avgResponseTime"
                stroke="#06b6d4"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: '#06b6d4', strokeWidth: 2, r: 3 }}
                name="Avg Response Time"
              />
              
              {/* Uptime Line */}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="uptime"
                stroke="#16a34a"
                strokeWidth={2}
                dot={{ fill: '#16a34a', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, stroke: '#16a34a', strokeWidth: 2 }}
                name="Uptime"
              />
              
              {/* Incidents Bar */}
              <Bar
                yAxisId="right"
                dataKey="incidents"
                fill="#dc2626"
                opacity={0.7}
                name="Incidents"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Performance Metrics Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t">
          {data.length > 0 && (
            <>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-600">Avg Response</span>
                </div>
                <p className="text-lg font-bold text-blue-600">
                  {Math.round(data.reduce((sum, d) => sum + (d.avgResponseTime || 0), 0) / data.length)}ms
                </p>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Clock className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Avg Uptime</span>
                </div>
                <p className="text-lg font-bold text-green-600">
                  {(data.reduce((sum, d) => sum + (d.uptime || 0), 0) / data.length).toFixed(1)}%
                </p>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-600">Total Incidents</span>
                </div>
                <p className="text-lg font-bold text-red-600">
                  {data.reduce((sum, d) => sum + (d.incidents || 0), 0)}
                </p>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-purple-600">Peak Response</span>
                </div>
                <p className="text-lg font-bold text-purple-600">
                  {Math.max(...data.map(d => d.responseTime || 0))}ms
                </p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}