import { useState } from 'react'
import { SystemHealth } from './SystemHealth'
import { ApiPerformance } from './ApiPerformance'
import { SlowEndpoints } from './SlowEndpoints'
import { ErrorLog } from './ErrorLog'
import { DataPipelineStatus } from './DataPipelineStatus'
import { useApiMetrics, useSystemHealth, useSyncStatus } from '../../../../hooks/useOperator'
import { RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

export function TechnicalTab() {
  const [timeRange, setTimeRange] = useState(24)
  const queryClient = useQueryClient()

  const { data: health, isLoading: healthLoading } = useSystemHealth()
  const { data: metrics, isLoading: metricsLoading } = useApiMetrics(timeRange)
  const { data: syncStatus, isLoading: syncLoading } = useSyncStatus()

  const isLoading = healthLoading || metricsLoading || syncLoading

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['operator'] })
  }

  return (
    <div className="space-y-6">
      {/* Header with time range selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="text-sm text-slate-600">Time Range:</label>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="text-sm border border-slate-200 rounded-md px-3 py-1.5 focus:ring-1 focus:ring-gold-500 focus:border-gold-500"
          >
            <option value={1}>Last 1 hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={48}>Last 48 hours</option>
            <option value={168}>Last 7 days</option>
          </select>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 hover:text-navy-900 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* System Health */}
      <SystemHealth health={health} isLoading={healthLoading} />

      {/* API Metrics Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ApiPerformance metrics={metrics} isLoading={metricsLoading} />
        <SlowEndpoints endpoints={metrics?.slow_endpoints ?? []} isLoading={metricsLoading} />
      </div>

      {/* Error Log and Data Pipeline */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <ErrorLog timeRange={timeRange} />
        <DataPipelineStatus syncStatus={syncStatus ?? []} isLoading={syncLoading} />
      </div>
    </div>
  )
}
