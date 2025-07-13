'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Target, AlertTriangle, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import { formatDowntime, formatSLAPercentage, getSLAStatusColor } from '@/lib/sla'

interface SLACalculation {
  target: {
    percentage: number
    name: string
    description: string
  }
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  startDate: string
  endDate: string
  actualUptime: number
  targetUptime: number
  met: boolean
  allowedDowntime: number
  actualDowntime: number
  remainingBudget: number
  totalChecks: number
  upChecks: number
  downChecks: number
}

interface SLAReport {
  monitorId: string
  monitorName: string
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  generatedAt: string
  summary: {
    totalTargets: number
    metTargets: number
    breachedTargets: number
    bestUptime: number
    worstUptime: number
  }
  calculations: SLACalculation[]
  breaches: SLACalculation[]
  metadata: {
    period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
    startDate: string
    endDate: string
    totalChecks: number
    monitorUrl: string
    calculatedAt: string
  }
}

interface SLADashboardProps {
  monitorId: string
}

export function SLADashboard({ monitorId }: SLADashboardProps) {
  const [report, setReport] = useState<SLAReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('monthly')
  const [selectedTargets, setSelectedTargets] = useState([99.9, 99.99])

  const fetchSLAData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        period,
        targets: selectedTargets.join(',')
      })
      
      const response = await fetch(`/api/monitors/${monitorId}/sla?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch SLA data')
      }
      
      const data = await response.json()
      setReport(data)
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching SLA data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSLAData()
  }, [monitorId, period, selectedTargets])

  const getSLAIcon = (calculation: SLACalculation) => {
    if (calculation.met) {
      return <CheckCircle className="h-5 w-5 text-green-600" />
    } else {
      return <AlertTriangle className="h-5 w-5 text-red-600" />
    }
  }

  const getStatusBadge = (calculation: SLACalculation) => {
    const color = getSLAStatusColor(calculation)
    const variant = color === 'green' ? 'default' : color === 'yellow' ? 'secondary' : 'destructive'
    
    return (
      <Badge variant={variant}>
        {calculation.met ? 'Met' : 'Breached'}
      </Badge>
    )
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Loading SLA data...</span>
        </div>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center py-8">
          <AlertTriangle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <p className="text-red-600">{error}</p>
          <Button onClick={fetchSLAData} className="mt-4">
            Retry
          </Button>
        </div>
      </Card>
    )
  }

  if (!report) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="text-sm font-medium mb-1 block">Period</label>
            <select 
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">SLA Targets</label>
            <div className="flex gap-2">
              {[99.5, 99.9, 99.95, 99.99, 99.999].map(target => (
                <label key={target} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTargets.includes(target)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedTargets([...selectedTargets, target])
                      } else {
                        setSelectedTargets(selectedTargets.filter(t => t !== target))
                      }
                    }}
                    className="rounded"
                  />
                  {target}%
                </label>
              ))}
            </div>
          </div>

          <Button onClick={fetchSLAData} size="sm">
            Refresh
          </Button>
        </div>
      </Card>

      {/* Summary */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">SLA Summary - {report.period}</h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{report.summary.totalTargets}</div>
            <div className="text-sm text-muted-foreground">Total Targets</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{report.summary.metTargets}</div>
            <div className="text-sm text-muted-foreground">Targets Met</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{report.summary.breachedTargets}</div>
            <div className="text-sm text-muted-foreground">Breached</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{formatSLAPercentage(report.summary.bestUptime)}</div>
            <div className="text-sm text-muted-foreground">Best Uptime</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{formatSLAPercentage(report.summary.worstUptime)}</div>
            <div className="text-sm text-muted-foreground">Worst Uptime</div>
          </div>
        </div>
      </Card>

      {/* Detailed SLA Calculations */}
      <div className="grid gap-4">
        {report.calculations.map((calculation, index) => (
          <Card key={index} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {getSLAIcon(calculation)}
                <div>
                  <h3 className="font-semibold">{calculation.target.name}</h3>
                  <p className="text-sm text-muted-foreground">{calculation.target.description}</p>
                </div>
              </div>
              {getStatusBadge(calculation)}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <div className="text-sm text-muted-foreground">Actual Uptime</div>
                <div className={`text-lg font-bold ${calculation.met ? 'text-green-600' : 'text-red-600'}`}>
                  {formatSLAPercentage(calculation.actualUptime)}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Target</div>
                <div className="text-lg font-bold">{formatSLAPercentage(calculation.targetUptime)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Downtime Budget</div>
                <div className="text-lg font-bold">{formatDowntime(calculation.allowedDowntime)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Remaining Budget</div>
                <div className={`text-lg font-bold ${calculation.remainingBudget > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {calculation.remainingBudget > 0 ? formatDowntime(calculation.remainingBudget) : `${formatDowntime(Math.abs(calculation.remainingBudget))} over`}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Total Checks</div>
                <div className="font-medium">{calculation.totalChecks.toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Successful</div>
                <div className="font-medium text-green-600">{calculation.upChecks.toLocaleString()}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground">Failed</div>
                <div className="font-medium text-red-600">{calculation.downChecks.toLocaleString()}</div>
              </div>
            </div>

            {!calculation.met && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">SLA Breach Detected</span>
                </div>
                <p className="text-sm text-red-700 mt-1">
                  This SLA target has been breached. Actual uptime is {(calculation.targetUptime - calculation.actualUptime).toFixed(2)} percentage points below the target.
                </p>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Metadata */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Report Information</span>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Period: {new Date(report.metadata.startDate).toLocaleDateString()} - {new Date(report.metadata.endDate).toLocaleDateString()}</p>
          <p>Total data points: {report.metadata.totalChecks.toLocaleString()}</p>
          <p>Generated: {new Date(report.metadata.calculatedAt).toLocaleString()}</p>
        </div>
      </Card>
    </div>
  )
}