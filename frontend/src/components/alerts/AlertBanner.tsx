import { useState } from 'react'
import { Link } from 'react-router-dom'
import { X, Bell, ChevronRight, AlertTriangle, TrendingDown, TrendingUp, Star } from 'lucide-react'
import { useActiveAlerts, useDismissAlert, getAlertSeverityColor, type Alert } from '../../hooks/useAlerts'
import { useAuthStore } from '../../stores/authStore'
import { Spinner } from '../ui/Spinner'

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

interface AlertBannerItemProps {
  alert: Alert
  canDismiss: boolean
  onDismiss: (id: string) => void
  isDismissing: boolean
}

function AlertBannerItem({ alert, canDismiss, onDismiss, isDismissing }: AlertBannerItemProps) {
  const colors = getAlertSeverityColor(alert.severity)

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${colors.bg} ${colors.border} ${colors.text}`}
    >
      <div className="flex-shrink-0">
        {getAlertIcon(alert.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{alert.title}</p>
        {alert.message && (
          <p className="text-sm opacity-80 truncate">{alert.message}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          to="/alerts"
          className="text-sm font-medium hover:underline flex items-center gap-1"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
        {canDismiss && (
          <button
            onClick={() => onDismiss(alert.id)}
            disabled={isDismissing}
            className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
            title="Dismiss alert"
          >
            {isDismissing ? (
              <Spinner size="sm" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export function AlertBanner() {
  const { data, isLoading } = useActiveAlerts()
  const dismissMutation = useDismissAlert()
  const { profile } = useAuthStore()
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  // Only owner can dismiss alerts
  const canDismiss = profile?.role === 'owner' || profile?.role === 'operator'

  const handleDismiss = async (alertId: string) => {
    setDismissingId(alertId)
    try {
      await dismissMutation.mutateAsync(alertId)
    } finally {
      setDismissingId(null)
    }
  }

  // Don't render if loading or no alerts
  if (isLoading || !data?.alerts?.length) {
    return null
  }

  // Show only the most important alert (highest severity, newest)
  const sortedAlerts = [...data.alerts].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    const aSev = severityOrder[a.severity] ?? 3
    const bSev = severityOrder[b.severity] ?? 3
    if (aSev !== bSev) return aSev - bSev
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const topAlert = sortedAlerts[0]
  const moreCount = data.active_count - 1

  return (
    <div className="space-y-2">
      <AlertBannerItem
        alert={topAlert}
        canDismiss={canDismiss}
        onDismiss={handleDismiss}
        isDismissing={dismissingId === topAlert.id}
      />
      {moreCount > 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400 pl-4">
          +{moreCount} more alert{moreCount > 1 ? 's' : ''}.{' '}
          <Link to="/alerts" className="text-navy-600 dark:text-gold-400 hover:underline">
            View all
          </Link>
        </p>
      )}
    </div>
  )
}
