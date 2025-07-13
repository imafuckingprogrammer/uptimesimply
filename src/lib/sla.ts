// SLA (Service Level Agreement) calculation and monitoring system

export interface SLATarget {
  percentage: number // 99.9, 99.99, etc.
  name: string
  description: string
}

export interface SLACalculation {
  target: SLATarget
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  startDate: string
  endDate: string
  actualUptime: number // percentage
  targetUptime: number // percentage
  met: boolean
  allowedDowntime: number // minutes
  actualDowntime: number // minutes
  remainingBudget: number // minutes (can be negative if breached)
  totalChecks: number
  upChecks: number
  downChecks: number
}

export interface SLABreach {
  id: string
  monitorId: string
  target: SLATarget
  period: string
  breachedAt: string
  actualUptime: number
  shortfall: number // percentage points below target
  resolved: boolean
  resolvedAt?: string
}

// Standard SLA targets
export const SLA_TARGETS: SLATarget[] = [
  {
    percentage: 99.9,
    name: '99.9% (Three Nines)',
    description: 'Allows ~43.8 minutes downtime per month'
  },
  {
    percentage: 99.99,
    name: '99.99% (Four Nines)',
    description: 'Allows ~4.38 minutes downtime per month'
  },
  {
    percentage: 99.999,
    name: '99.999% (Five Nines)',
    description: 'Allows ~26.3 seconds downtime per month'
  },
  {
    percentage: 99.95,
    name: '99.95% (High Availability)',
    description: 'Allows ~21.9 minutes downtime per month'
  },
  {
    percentage: 99.5,
    name: '99.5% (Standard)',
    description: 'Allows ~3.6 hours downtime per month'
  }
]

// Time period definitions in minutes
export const TIME_PERIODS = {
  daily: 24 * 60,           // 1 day
  weekly: 7 * 24 * 60,      // 7 days
  monthly: 30 * 24 * 60,    // 30 days (approximate)
  quarterly: 90 * 24 * 60,  // 90 days
  yearly: 365 * 24 * 60     // 365 days
}

/**
 * Calculate allowed downtime for a given SLA target and period
 */
export function calculateAllowedDowntime(target: SLATarget, period: keyof typeof TIME_PERIODS): number {
  const totalMinutes = TIME_PERIODS[period]
  const uptimeRequired = target.percentage / 100
  const downtimeAllowed = totalMinutes * (1 - uptimeRequired)
  return Math.floor(downtimeAllowed)
}

/**
 * Calculate SLA compliance for a given period
 */
export function calculateSLA(
  checks: Array<{ status: string; checked_at: string; response_time?: number }>,
  target: SLATarget,
  period: keyof typeof TIME_PERIODS,
  startDate: Date,
  endDate: Date
): SLACalculation {
  const totalChecks = checks.length
  const upChecks = checks.filter(check => check.status === 'up').length
  const downChecks = totalChecks - upChecks

  // Calculate actual uptime percentage
  const actualUptime = totalChecks > 0 ? (upChecks / totalChecks) * 100 : 0

  // Calculate downtime in minutes (estimate based on check frequency)
  // Assume checks are evenly distributed over the period
  const periodMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60)
  const estimatedDowntime = (downChecks / totalChecks) * periodMinutes

  // Calculate allowed downtime
  const allowedDowntime = calculateAllowedDowntime(target, period)

  // Calculate remaining budget
  const remainingBudget = allowedDowntime - estimatedDowntime

  return {
    target,
    period,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    actualUptime: Math.round(actualUptime * 100) / 100, // Round to 2 decimal places
    targetUptime: target.percentage,
    met: actualUptime >= target.percentage,
    allowedDowntime,
    actualDowntime: Math.round(estimatedDowntime),
    remainingBudget: Math.round(remainingBudget),
    totalChecks,
    upChecks,
    downChecks
  }
}

/**
 * Get date range for a specific period
 */
export function getDateRangeForPeriod(period: keyof typeof TIME_PERIODS, endDate?: Date): { startDate: Date; endDate: Date } {
  const end = endDate || new Date()
  const start = new Date(end.getTime() - TIME_PERIODS[period] * 60 * 1000)

  return { startDate: start, endDate: end }
}

/**
 * Calculate multiple SLA targets for a monitor
 */
export function calculateMultipleSLAs(
  checks: Array<{ status: string; checked_at: string; response_time?: number }>,
  targets: SLATarget[],
  period: keyof typeof TIME_PERIODS,
  startDate?: Date,
  endDate?: Date
): SLACalculation[] {
  const { startDate: start, endDate: end } = startDate && endDate 
    ? { startDate, endDate }
    : getDateRangeForPeriod(period)

  return targets.map(target => 
    calculateSLA(checks, target, period, start, end)
  )
}

/**
 * Detect SLA breaches
 */
export function detectSLABreaches(calculations: SLACalculation[]): SLACalculation[] {
  return calculations.filter(calc => !calc.met)
}

/**
 * Generate SLA report summary
 */
export function generateSLAReport(
  monitorId: string,
  monitorName: string,
  calculations: SLACalculation[]
): {
  monitorId: string
  monitorName: string
  period: string
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
} {
  const breaches = detectSLABreaches(calculations)
  const uptimes = calculations.map(c => c.actualUptime)

  return {
    monitorId,
    monitorName,
    period: calculations[0]?.period || 'unknown',
    generatedAt: new Date().toISOString(),
    summary: {
      totalTargets: calculations.length,
      metTargets: calculations.length - breaches.length,
      breachedTargets: breaches.length,
      bestUptime: Math.max(...uptimes),
      worstUptime: Math.min(...uptimes)
    },
    calculations,
    breaches
  }
}

/**
 * Format SLA percentage for display
 */
export function formatSLAPercentage(percentage: number): string {
  if (percentage >= 99.999) {
    return percentage.toFixed(3) + '%'
  } else if (percentage >= 99.9) {
    return percentage.toFixed(2) + '%'
  } else {
    return percentage.toFixed(1) + '%'
  }
}

/**
 * Format downtime duration for display
 */
export function formatDowntime(minutes: number): string {
  if (minutes < 1) {
    return '< 1 minute'
  } else if (minutes < 60) {
    return `${Math.round(minutes)} minutes`
  } else if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = Math.round(minutes % 60)
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  } else {
    const days = Math.floor(minutes / (24 * 60))
    const remainingHours = Math.floor((minutes % (24 * 60)) / 60)
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }
}

/**
 * Get SLA status color for UI
 */
export function getSLAStatusColor(calculation: SLACalculation): string {
  if (calculation.met) {
    return 'green'
  } else if (calculation.actualUptime >= calculation.targetUptime - 0.1) {
    return 'yellow' // Close to breach
  } else {
    return 'red' // Significant breach
  }
}