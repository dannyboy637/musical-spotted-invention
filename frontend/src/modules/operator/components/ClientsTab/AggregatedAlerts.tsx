import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOperatorAlerts } from '../../../../hooks/useOperator'
import type { OperatorAlert } from '../../../../hooks/useOperator'
import { useTenantStore } from '../../../../stores/tenantStore'
import { Bell, ExternalLink, Filter } from 'lucide-react'
import { Spinner } from '../../../../components/ui/Spinner'
import { formatDistanceToNow } from 'date-fns'

const severityOptions = [
  { value: '', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
]

export function AggregatedAlerts() {
  const [severityFilter, setSeverityFilter] = useState('')
  const { data: alerts, isLoading } = useOperatorAlerts({
    severity: severityFilter || undefined,
    limit: 10,
  })

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-slate-500" />
          <h3 className="font-semibold text-navy-900">Alerts Feed</h3>
          {alerts && alerts.length > 0 && (
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              {alerts.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-400" />
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="text-xs border-0 bg-transparent text-slate-600 focus:ring-0 cursor-pointer"
          >
            {severityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : !alerts || alerts.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            No active alerts
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((alert) => (
              <AlertItem key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AlertItem({ alert }: { alert: OperatorAlert }) {
  const navigate = useNavigate()
  const { setActiveTenant } = useTenantStore()

  const handleClick = () => {
    if (alert.tenants) {
      setActiveTenant({
        id: alert.tenant_id,
        name: alert.tenants.name,
        slug: alert.tenants.slug,
      })
      navigate('/alerts')
    }
  }

  const severityColors = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
  }

  return (
    <div
      className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-xs px-1.5 py-0.5 rounded border ${
                severityColors[alert.severity]
              }`}
            >
              {alert.severity}
            </span>
            <span className="text-xs text-slate-500 truncate">
              {alert.tenants?.name}
            </span>
          </div>
          <p className="text-sm text-navy-900 line-clamp-2">{alert.title}</p>
          <p className="text-xs text-slate-500 mt-1">
            {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
          </p>
        </div>
        <ExternalLink size={14} className="text-slate-400 flex-shrink-0 mt-1" />
      </div>
    </div>
  )
}
