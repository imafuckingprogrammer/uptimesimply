'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Loader } from '@/components/ui/loader'

interface UptimeChartProps {
  monitorId: string
  days?: number
  hours?: number // New prop for today view
}

interface ChartDataPoint {
  date: string
  uptime: number
  avgResponseTime: number
}

export function UptimeChart({ monitorId, days = 7, hours }: UptimeChartProps) {
  const [data, setData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchChartData()
  }, [monitorId, days, hours])

  const fetchChartData = async () => {
    try {
      let url = `/api/monitors/${monitorId}/charts`
      if (hours) {
        url += `?hours=${hours}`
      } else {
        url += `?days=${days}`
      }
      
      const response = await fetch(url)
      const chartData = await response.json()
      setData(chartData)
    } catch (error) {
      console.error('Failed to fetch chart data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader size="lg" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        No data available for the selected period
      </div>
    )
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart 
          data={data}
          margin={{ top: 10, right: 30, left: 20, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 11 }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
            interval="preserveStartEnd"
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            domain={hours ? [0, 100] : [90, 100]}
            tick={{ fontSize: 11 }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
            label={{ value: 'Uptime %', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            width={50}
          />
          <Tooltip 
            formatter={(value, name) => [
              name === 'uptime' ? `${value}%` : `${value}ms`,
              name === 'uptime' ? 'Uptime' : 'Avg Response Time'
            ]}
            labelFormatter={(label) => `Time: ${label}`}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="uptime" 
            stroke="#16a34a" 
            strokeWidth={2}
            dot={{ fill: '#16a34a', strokeWidth: 2, r: 3 }}
            activeDot={{ r: 5, stroke: '#16a34a', strokeWidth: 2, fill: '#ffffff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}