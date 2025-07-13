'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loader'
import { 
  Activity, 
  Globe, 
  Clock, 
  Shield, 
  MapPin, 
  Server, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Route,
  Wifi,
  Database,
  Eye
} from 'lucide-react'

interface IncidentDiagnosticsProps {
  monitorId: string
  incidentId: string
  isOpen: boolean
  onClose: () => void
}

interface DiagnosticData {
  incident: any
  monitor: any
  diagnostics: Record<string, any[]>
  total_diagnostics: number
}

export function IncidentDiagnostics({ monitorId, incidentId, isOpen, onClose }: IncidentDiagnosticsProps) {
  const [data, setData] = useState<DiagnosticData | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && incidentId) {
      fetchDiagnostics()
    }
  }, [isOpen, incidentId, monitorId])

  const fetchDiagnostics = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/monitors/${monitorId}/incident-diagnostics?incident_id=${incidentId}`)
      if (response.ok) {
        const diagnosticsData = await response.json()
        setData(diagnosticsData)
        
        // Auto-select first location
        const locations = Object.keys(diagnosticsData.diagnostics)
        if (locations.length > 0) {
          setSelectedLocation(locations[0])
        }
      }
    } catch (error) {
      console.error('Failed to fetch diagnostics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const selectedDiagnostic = selectedLocation && data?.diagnostics[selectedLocation]?.[0]
  const locations = data ? Object.keys(data.diagnostics) : []

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-background border rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold">Enhanced Incident Diagnostics</h2>
                <p className="text-muted-foreground text-sm">
                  {data?.monitor?.name} - {data?.incident?.started_at ? new Date(data.incident.started_at).toLocaleString() : 'Unknown time'}
                </p>
              </div>
            </div>
            <Button variant="ghost" onClick={onClose}>
              <XCircle className="h-5 w-5" />
            </Button>
          </div>

          {loading ? (
            <LoadingState size="lg" />
          ) : !data || locations.length === 0 ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Diagnostics Available</h3>
              <p className="text-muted-foreground">
                Enhanced diagnostics were not captured for this incident or are still being processed.
              </p>
            </div>
          ) : (
            <div className="flex h-[calc(90vh-80px)]">
              {/* Location Sidebar */}
              <div className="w-64 border-r bg-muted/30 p-4">
                <h3 className="font-medium text-sm mb-3 text-muted-foreground">DIAGNOSTIC LOCATIONS</h3>
                <div className="space-y-2">
                  {locations.map((location) => (
                    <Button
                      key={location}
                      variant={selectedLocation === location ? "default" : "ghost"}
                      className="w-full justify-start text-sm"
                      onClick={() => setSelectedLocation(location)}
                    >
                      <MapPin className="h-4 w-4 mr-2" />
                      {location.replace('-', ' ').toUpperCase()}
                    </Button>
                  ))}
                </div>
                
                {data.incident && (
                  <div className="mt-6 p-3 bg-background rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Incident Summary</h4>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div>Duration: {data.incident.duration_minutes ? `${data.incident.duration_minutes}m` : 'Ongoing'}</div>
                      <div>Cause: {data.incident.cause || 'Unknown'}</div>
                      <div>Status: {data.incident.resolved ? 'Resolved' : 'Ongoing'}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Main Diagnostics Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {selectedDiagnostic ? (
                  <div className="space-y-6">
                    {/* DNS Analysis */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Globe className="h-5 w-5" />
                          DNS Resolution Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="flex items-center gap-2">
                            {selectedDiagnostic.dns_success ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <div>
                              <div className="font-medium">DNS Resolution</div>
                              <div className="text-sm text-muted-foreground">
                                {selectedDiagnostic.dns_success ? 'Successful' : 'Failed'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-blue-600" />
                            <div>
                              <div className="font-medium">{selectedDiagnostic.dns_resolution_time_ms || 0}ms</div>
                              <div className="text-sm text-muted-foreground">Resolution Time</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Server className="h-5 w-5 text-purple-600" />
                            <div>
                              <div className="font-medium">{selectedDiagnostic.dns_resolved_ips?.length || 0}</div>
                              <div className="text-sm text-muted-foreground">IP Addresses</div>
                            </div>
                          </div>
                        </div>
                        
                        {selectedDiagnostic.dns_resolved_ips?.length > 0 && (
                          <div>
                            <div className="font-medium text-sm mb-2">Resolved IP Addresses:</div>
                            <div className="flex flex-wrap gap-2">
                              {selectedDiagnostic.dns_resolved_ips.map((ip: string, index: number) => (
                                <span key={index} className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">
                                  {ip}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {selectedDiagnostic.dns_errors?.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded p-3">
                            <div className="font-medium text-red-800 text-sm mb-1">DNS Errors:</div>
                            <div className="space-y-1">
                              {selectedDiagnostic.dns_errors.map((error: string, index: number) => (
                                <div key={index} className="text-red-700 text-sm">{error}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Network Path Analysis */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Route className="h-5 w-5" />
                          Network Path Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div className="flex items-center gap-2">
                            {selectedDiagnostic.traceroute_success ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <div>
                              <div className="font-medium">Path Analysis</div>
                              <div className="text-sm text-muted-foreground">
                                {selectedDiagnostic.traceroute_success ? 'Completed' : 'Failed'}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Route className="h-5 w-5 text-blue-600" />
                            <div>
                              <div className="font-medium">{selectedDiagnostic.traceroute_total_hops || 0}</div>
                              <div className="text-sm text-muted-foreground">Network Hops</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-orange-600" />
                            <div>
                              <div className="font-medium">{selectedDiagnostic.traceroute_total_time_ms || 0}ms</div>
                              <div className="text-sm text-muted-foreground">Total Time</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Wifi className="h-5 w-5 text-red-600" />
                            <div>
                              <div className="font-medium">{selectedDiagnostic.traceroute_packet_loss || 0}%</div>
                              <div className="text-sm text-muted-foreground">Packet Loss</div>
                            </div>
                          </div>
                        </div>
                        
                        {selectedDiagnostic.traceroute_hops && selectedDiagnostic.traceroute_hops.length > 0 && (
                          <div>
                            <div className="font-medium text-sm mb-3">Network Hops:</div>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                              {selectedDiagnostic.traceroute_hops.map((hop: any, index: number) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-muted-foreground">#{hop.hop_number}</span>
                                    <span className="font-mono">{hop.ip_address}</span>
                                    {hop.hostname && (
                                      <span className="text-muted-foreground">{hop.hostname}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {hop.timeout ? (
                                      <span className="text-red-600 text-xs">Timeout</span>
                                    ) : (
                                      <span className="text-green-600 text-xs">{hop.avg_time_ms}ms</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* HTTP Response Analysis */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Database className="h-5 w-5" />
                          HTTP Response Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <div className="font-medium">{selectedDiagnostic.http_status_code || 0}</div>
                            <div className="text-sm text-muted-foreground">Status Code</div>
                          </div>
                          <div>
                            <div className="font-medium">{selectedDiagnostic.http_total_time_ms || 0}ms</div>
                            <div className="text-sm text-muted-foreground">Total Time</div>
                          </div>
                          <div>
                            <div className="font-medium">{selectedDiagnostic.http_first_byte_time_ms || 0}ms</div>
                            <div className="text-sm text-muted-foreground">First Byte</div>
                          </div>
                          <div>
                            <div className="font-medium">{selectedDiagnostic.http_response_size_bytes || 0} bytes</div>
                            <div className="text-sm text-muted-foreground">Response Size</div>
                          </div>
                        </div>
                        
                        {selectedDiagnostic.http_error_details && (
                          <div className="bg-red-50 border border-red-200 rounded p-3">
                            <div className="font-medium text-red-800 text-sm mb-1">HTTP Error:</div>
                            <div className="text-red-700 text-sm">{selectedDiagnostic.http_error_details}</div>
                          </div>
                        )}
                        
                        {selectedDiagnostic.http_server_info && selectedDiagnostic.http_server_info !== 'unknown' && (
                          <div>
                            <div className="font-medium text-sm mb-1">Server Information:</div>
                            <span className="text-sm bg-gray-100 px-2 py-1 rounded">{selectedDiagnostic.http_server_info}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Geographic Analysis */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <MapPin className="h-5 w-5" />
                          Geographic & Network Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <div className="font-medium text-sm mb-2">Server Location:</div>
                            <div className="space-y-1 text-sm">
                              <div>{selectedDiagnostic.geo_server_city}, {selectedDiagnostic.geo_server_country}</div>
                              {selectedDiagnostic.geo_server_latitude && selectedDiagnostic.geo_server_longitude && (
                                <div className="text-muted-foreground">
                                  {selectedDiagnostic.geo_server_latitude}°, {selectedDiagnostic.geo_server_longitude}°
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <div className="font-medium text-sm mb-2">Network Information:</div>
                            <div className="space-y-1 text-sm">
                              <div>{selectedDiagnostic.geo_isp}</div>
                              <div className="text-muted-foreground">ASN: {selectedDiagnostic.geo_asn}</div>
                              {selectedDiagnostic.geo_is_cdn && (
                                <div className="text-blue-600">CDN: {selectedDiagnostic.geo_cdn_provider}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* SSL Analysis */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Shield className="h-5 w-5" />
                          SSL/TLS Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="flex items-center gap-2">
                            {selectedDiagnostic.ssl_certificate_valid ? (
                              <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-600" />
                            )}
                            <div>
                              <div className="font-medium">Certificate</div>
                              <div className="text-sm text-muted-foreground">
                                {selectedDiagnostic.ssl_certificate_valid ? 'Valid' : 'Invalid'}
                              </div>
                            </div>
                          </div>
                          
                          <div>
                            <div className="font-medium">{selectedDiagnostic.ssl_tls_version || 'Unknown'}</div>
                            <div className="text-sm text-muted-foreground">TLS Version</div>
                          </div>
                          
                          <div>
                            <div className="font-medium">{selectedDiagnostic.ssl_cipher_suite || 'Unknown'}</div>
                            <div className="text-sm text-muted-foreground">Cipher Suite</div>
                          </div>
                          
                          <div>
                            <div className="font-medium">{selectedDiagnostic.ssl_certificate_issuer || 'Unknown'}</div>
                            <div className="text-sm text-muted-foreground">Issuer</div>
                          </div>
                        </div>
                        
                        {selectedDiagnostic.ssl_errors?.length > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded p-3">
                            <div className="font-medium text-red-800 text-sm mb-1">SSL Errors:</div>
                            <div className="space-y-1">
                              {selectedDiagnostic.ssl_errors.map((error: string, index: number) => (
                                <div key={index} className="text-red-700 text-sm">{error}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Eye className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Select a Location</h3>
                    <p className="text-muted-foreground">
                      Choose a diagnostic location from the sidebar to view detailed network analysis.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}