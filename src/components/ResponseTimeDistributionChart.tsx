'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart3, Timer, TrendingUp, AlertCircle } from 'lucide-react'

interface DistributionData {
  range: string
  count: number
  percentage: number
  label: string
  color: string
}

interface ResponseTimeDistributionChartProps {
  monitorId: string
}

export function ResponseTimeDistributionChart({ monitorId }: ResponseTimeDistributionChartProps) {
  const [data, setData] = useState<DistributionData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('7d')
  const [stats, setStats] = useState<{
    total: number
    average: number
    median: number
    p95: number
    p99: number
  } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/monitors/${monitorId}/response-distribution?period=${period}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch response time distribution')
        }

        const result = await response.json()
        setData(result.distribution || [])
        setStats(result.stats || null)
      } catch (error: any) {
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [monitorId, period])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="font-medium text-gray-900 mb-1">{data.label}</p>
          <div className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: data.color }}
            />
            <span className="text-gray-600">Requests:</span>
            <span className="font-medium">{data.count}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {data.percentage.toFixed(1)}% of total requests
          </p>
        </div>
      )
    }
    return null
  }

  const getBarColor = (index: number, total: number) => {
    // Color gradient from green (fast) to red (slow)
    const ratio = index / (total - 1)
    if (ratio < 0.33) return '#16a34a' // Green for fast responses
    if (ratio < 0.66) return '#f59e0b' // Yellow for medium responses
    return '#dc2626' // Red for slow responses
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Response Time Distribution
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
            <BarChart3 className="h-5 w-5" />
            Response Time Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-80 text-gray-500">
            <p>Error loading response time distribution: {error}</p>
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
            <BarChart3 className="h-5 w-5" />
            Response Time Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-80 text-gray-500">
            <p>No response time data available for this period</p>
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
            <BarChart3 className="h-5 w-5" />
            Response Time Distribution
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
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="range" 
                stroke="#64748b"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                stroke="#64748b"
                fontSize={12}
                label={{ value: 'Number of Requests', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getBarColor(index, data.length)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Performance Statistics */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-4 border-t">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Timer className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">Average</span>
              </div>
              <p className="text-lg font-bold text-blue-600">
                {Math.round(stats.average)}ms
              </p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">Median</span>
              </div>
              <p className="text-lg font-bold text-green-600">
                {Math.round(stats.median)}ms
              </p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-600">95th %</span>
              </div>
              <p className="text-lg font-bold text-yellow-600">
                {Math.round(stats.p95)}ms
              </p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-600">99th %</span>
              </div>
              <p className="text-lg font-bold text-red-600">
                {Math.round(stats.p99)}ms
              </p>
            </div>
            
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <BarChart3 className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-600">Total</span>
              </div>
              <p className="text-lg font-bold text-purple-600">
                {stats.total.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Performance Insights */}
        {stats && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Performance Insights</h4>
            <div className="space-y-1 text-xs text-gray-600">
              {stats.p95 > 2000 && (
                <p className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-red-500" />
                  95% of requests are slower than 2 seconds - consider optimization
                </p>
              )}
              {stats.average < 500 && (
                <p className="flex items-center gap-1">
                  <Timer className="h-3 w-3 text-green-500" />
                  Excellent average response time under 500ms
                </p>
              )}
              {stats.p99 / stats.median > 5 && (
                <p className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-yellow-500" />
                  High variability detected - some requests are significantly slower
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}