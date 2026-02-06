import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Bell, RefreshCw, Filter, X, TrendingDown, TrendingUp, Star, AlertTriangle, Check, CheckSquare, Square, Trash2, ArrowRight, History } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { PageHeader } from '../../components/layout/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import { WatchListSection } from './WatchListSection'
import {
  useAlerts,
  useDismissAlert,
  useTriggerScan,
  getAlertColor,
  getAlertTypeLabel,
  type Alert,
} from '../../hooks/useAlerts'

function getAlertIcon(type: Alert['type']) {
  switch (type) {
    case 'revenue_drop':
      return <TrendingDown className="h-5 w-5" />
    case 'item_spike':
      return <TrendingUp className="h-5 w-5" />
    case 'item_crash':
      return <TrendingDown className="h-5 w-5" />
    case 'new_star':
      return <Star className="h-5 w-5" />
    case 'new_dog':
      return <AlertTriangle className="h-5 w-5" />
    default:
      return <Bell className="h-5 w-5" />
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

interface AlertCardProps {
  alert: Alert
  canDismiss: boolean
  onDismiss: (id: string) => void
  isDismissing: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
  showCheckbox?: boolean
}

function AlertCard({ alert, canDismiss, onDismiss, isDismissing, isSelected, onToggleSelect, showCheckbox }: AlertCardProps) {
  const colors = getAlertColor(alert)
  const isDismissed = !!alert.dismissed_at

  return (
    <div
      className={`rounded-lg border p-4 ${colors.bg} ${colors.border} ${
        isDismissed ? 'opacity-60' : ''
      } ${isSelected ? 'ring-2 ring-navy-400' : ''}`}
    >
      <div className="flex items-start gap-3">
        {showCheckbox && !isDismissed && (
          <button
            type="button"
            onClick={() => onToggleSelect?.(alert.id)}
            className="flex-shrink-0 mt-0.5 text-slate-500 hover:text-navy-600 transition-colors"
          >
            {isSelected ? (
              <CheckSquare className="h-5 w-5 text-navy-600" />
            ) : (
              <Square className="h-5 w-5" />
            )}
          </button>
        )}
        <div className={`flex-shrink-0 ${colors.text}`}>
          {getAlertIcon(alert.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className={`font-medium ${colors.text}`}>{alert.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                  {getAlertTypeLabel(alert.type)}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatRelativeTime(alert.created_at)}
                </span>
              </div>
            </div>
            {canDismiss && !isDismissed && (
              <button
                onClick={() => onDismiss(alert.id)}
                disabled={isDismissing}
                className="flex-shrink-0 p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                title="Dismiss alert"
              >
                {isDismissing ? (
                  <Spinner size="sm" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
            )}
            {isDismissed && (
              <span className="flex-shrink-0 flex items-center gap-1 text-xs text-slate-500">
                <Check className="h-3 w-3" />
                Dismissed
              </span>
            )}
          </div>
          {alert.message && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {alert.message}
            </p>
          )}
          {alert.data && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
              <div className="grid grid-cols-2 gap-2 text-xs">
                {alert.data.change_pct != null && (
                  <div>
                    <span className="text-slate-500">Change:</span>{' '}
                    <span className={alert.data.change_pct as number > 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {(alert.data.change_pct as number) > 0 ? '+' : ''}
                      {(alert.data.change_pct as number).toFixed(1)}%
                    </span>
                  </div>
                )}
                {typeof alert.data.item_name === 'string' && (
                  <div>
                    <span className="text-slate-500">Item:</span>{' '}
                    <span className="font-medium">{alert.data.item_name}</span>
                  </div>
                )}
                {alert.data.current_quantity != null && (
                  <div>
                    <span className="text-slate-500">Current:</span>{' '}
                    <span className="font-medium">{(alert.data.current_quantity as number).toLocaleString()}</span>
                  </div>
                )}
                {alert.data.prior_quantity != null && (
                  <div>
                    <span className="text-slate-500">Prior:</span>{' '}
                    <span className="font-medium">{(alert.data.prior_quantity as number).toLocaleString()}</span>
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

export function AlertsPage() {
  const { profile } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [showDismissed, setShowDismissed] = useState(true)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDismissing, setIsBulkDismissing] = useState(false)

  const { data, isLoading } = useAlerts({
    activeOnly: !showDismissed,
    alertType: typeFilter,
  })
  const dismissMutation = useDismissAlert()
  const scanMutation = useTriggerScan()

  const currentTenant = profile?.role === 'operator' ? activeTenant : profile?.tenant
  const canDismiss = profile?.role === 'owner' || profile?.role === 'operator'

  // Get active (non-dismissed) alerts for selection
  const activeAlerts = useMemo(
    () => data?.alerts?.filter((a) => !a.dismissed_at) || [],
    [data?.alerts]
  )

  const handleDismiss = async (alertId: string) => {
    setDismissingId(alertId)
    try {
      await dismissMutation.mutateAsync(alertId)
      // Remove from selected if it was selected
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(alertId)
        return next
      })
    } finally {
      setDismissingId(null)
    }
  }

  const handleToggleSelect = (alertId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(alertId)) {
        next.delete(alertId)
      } else {
        next.add(alertId)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selectedIds.size === activeAlerts.length) {
      // Deselect all
      setSelectedIds(new Set())
    } else {
      // Select all active
      setSelectedIds(new Set(activeAlerts.map((a) => a.id)))
    }
  }

  const handleDismissSelected = async () => {
    if (selectedIds.size === 0) return
    setIsBulkDismissing(true)
    try {
      // Dismiss all selected alerts
      for (const alertId of selectedIds) {
        await dismissMutation.mutateAsync(alertId)
      }
      setSelectedIds(new Set())
    } finally {
      setIsBulkDismissing(false)
    }
  }

  const handleScan = async () => {
    await scanMutation.mutateAsync()
  }

  if (!currentTenant) {
    return (
      <div className="space-y-6">
        <PageHeader title="Alerts" />
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            {profile?.role === 'operator'
              ? 'Select a tenant from the header to view their alerts.'
              : 'No tenant assigned. Contact your administrator.'}
          </p>
        </div>
      </div>
    )
  }

  const alertTypes = [
    { value: undefined, label: 'All Types' },
    { value: 'revenue_drop', label: 'Revenue Drop' },
    { value: 'item_spike', label: 'Item Spike' },
    { value: 'item_crash', label: 'Item Crash' },
    { value: 'new_star', label: 'New Star' },
    { value: 'new_dog', label: 'New Dog' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        subtitle={`Recent anomaly notifications for ${currentTenant.name} (last 7 days)`}
      />

      {/* Link to Movements for historical analysis */}
      <div className="bg-navy-50 border border-navy-200 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="h-5 w-5 text-navy-600" />
          <div>
            <p className="text-sm font-medium text-navy-800">Looking for historical trends?</p>
            <p className="text-xs text-navy-600">View year-over-year comparisons, seasonal patterns, and quadrant movements.</p>
          </div>
        </div>
        <Link
          to="/movements"
          className="flex items-center gap-2 px-4 py-2 bg-navy-600 hover:bg-navy-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          View Movements
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={typeFilter || ''}
              onChange={(e) => setTypeFilter(e.target.value || undefined)}
              className="text-sm border border-slate-200 dark:border-slate-600 rounded-md px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              {alertTypes.map((type) => (
                <option key={type.value || 'all'} value={type.value || ''}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Show Dismissed Toggle */}
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showDismissed}
              onChange={(e) => setShowDismissed(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            Show dismissed
          </label>
        </div>

        <div className="flex items-center gap-3">
          {/* Dismiss Selected Button */}
          {canDismiss && selectedIds.size > 0 && (
            <button
              onClick={handleDismissSelected}
              disabled={isBulkDismissing}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {isBulkDismissing ? (
                <Spinner size="sm" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Dismiss {selectedIds.size} selected
            </button>
          )}
          {/* Scan Button */}
          <button
            onClick={handleScan}
            disabled={scanMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-navy-600 hover:bg-navy-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {scanMutation.isPending ? (
              <Spinner size="sm" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {scanMutation.isPending ? 'Scanning...' : 'Run Scan'}
          </button>
        </div>
      </div>

      {/* Scan Result Message */}
      {scanMutation.isSuccess && scanMutation.data && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-3 text-emerald-700 dark:text-emerald-300 text-sm">
          {scanMutation.data.message}
        </div>
      )}

      {/* Summary Stats */}
      {data && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Active Alerts</p>
            <p className="text-2xl font-semibold text-navy-900 dark:text-white">
              {data.active_count}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Alerts</p>
            <p className="text-2xl font-semibold text-navy-900 dark:text-white">
              {data.total}
            </p>
          </div>
        </div>
      )}

      {/* Alerts List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">Loading alerts...</p>
        </div>
      ) : !data?.alerts?.length ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <Bell className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-400 mb-2">No alerts found</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {!showDismissed
              ? 'No active alerts. Try showing dismissed alerts or run a scan.'
              : 'Run a scan to check for anomalies in your data.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select All Header */}
          {canDismiss && activeAlerts.length > 0 && (
            <div className="flex items-center gap-3 px-1">
              <button
                type="button"
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-navy-600 transition-colors"
              >
                {selectedIds.size === activeAlerts.length && activeAlerts.length > 0 ? (
                  <CheckSquare className="h-4 w-4 text-navy-600" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
                {selectedIds.size === activeAlerts.length && activeAlerts.length > 0
                  ? 'Deselect all'
                  : `Select all (${activeAlerts.length})`}
              </button>
            </div>
          )}
          {data.alerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              canDismiss={canDismiss}
              onDismiss={handleDismiss}
              isDismissing={dismissingId === alert.id}
              isSelected={selectedIds.has(alert.id)}
              onToggleSelect={handleToggleSelect}
              showCheckbox={canDismiss}
            />
          ))}
        </div>
      )}

      <WatchListSection />
    </div>
  )
}
