'use client'

import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { Loader } from '@/components/ui/loader'

interface ResponseTimeChartProps {
  monitorId: string
  days?: number
  hours?: number
}

interface ChartDataPoint {
  date: string
  avgResponseTime: number
  timeKey: string
}

export function ResponseTimeChart({ monitorId, days = 7, hours }: ResponseTimeChartProps) {
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
      
      // Filter out zero response times and format data
      const filteredData = chartData.filter((point: ChartDataPoint) => point.avgResponseTime > 0)
      setData(filteredData)
    } catch (error) {
      console.error('Failed to fetch response time data:', error)
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
        No response time data available for the selected period
      </div>
    )
  }

  // Calculate min and max response times for better Y-axis scaling
  const responseTimes = data.map(d => d.avgResponseTime)
  const minTime = Math.min(...responseTimes)
  const maxTime = Math.max(...responseTimes)
  const padding = (maxTime - minTime) * 0.1 // 10% padding
  const yAxisMin = Math.max(0, minTime - padding)
  const yAxisMax = maxTime + padding

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart 
          data={data}
          margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
        >
          <defs>
            <linearGradient id="responseTimeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
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
            domain={[yAxisMin, yAxisMax]}
            tick={{ fontSize: 11 }}
            axisLine={{ stroke: '#e5e7eb' }}
            tickLine={{ stroke: '#e5e7eb' }}
            label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            tickFormatter={(value) => `${Math.round(value)}`}
            width={55}
          />
          <Tooltip 
            formatter={(value: number) => [`${Math.round(value)}ms`, 'Response Time']}
            labelFormatter={(label) => `Time: ${label}`}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Area
            type="monotone"
            dataKey="avgResponseTime"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#responseTimeGradient)"
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 3 }}
            activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2, fill: '#ffffff' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}