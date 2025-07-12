// Development-only monitoring service
// Remove this file before deploying to production

let monitoringInterval: NodeJS.Timeout | null = null

export function startDevMonitoring() {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') {
    return
  }

  // Only run in development
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
  }

  console.log('🔍 Starting development monitoring (checks every 2 minutes)')
  
  // Check immediately
  checkSites()
  
  // Then check every 2 minutes
  monitoringInterval = setInterval(checkSites, 2 * 60 * 1000)
}

export function stopDevMonitoring() {
  if (monitoringInterval) {
    clearInterval(monitoringInterval)
    monitoringInterval = null
    console.log('⏹️ Stopped development monitoring')
  }
}

async function checkSites() {
  try {
    console.log('🔄 Running development site check...')
    const response = await fetch('/api/cron/check-websites', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ Site check completed:', data.results?.length || 0, 'monitors checked')
    } else {
      console.error('❌ Site check failed:', response.status)
    }
  } catch (error) {
    console.error('❌ Site check error:', error)
  }
}