import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { TrendingDown, TrendingUp, Minus, Eye } from 'lucide-react'
import { useWatchListSummary } from '../../hooks/useAlerts'
import { Spinner } from '../../components/ui/Spinner'
import { formatCurrency } from '../../lib/chartConfig'
import { useSettingsStore } from '../../stores/settingsStore'

export function WatchListWidget() {
  const { data, isLoading } = useWatchListSummary()
  const numberFormat = useSettingsStore((state) => state.numberFormat)

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-2 text-slate-500">
          <Spinner size="sm" /> Loading watch list...
        </div>
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex items-center gap-2 text-slate-700">
          <Eye className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Watch List</h3>
        </div>
        <p className="text-sm text-slate-500 mt-2">
          No watched items yet.
        </p>
        <Link
          to="/alerts"
          className="inline-flex items-center mt-3 text-sm font-medium text-navy-600 hover:underline"
        >
          Add items to watch list
        </Link>
      </div>
    )
  }

  const periodLabel = data.period?.start_date && data.period?.end_date
    ? `${format(parseISO(data.period.start_date), 'MMM d')} – ${format(parseISO(data.period.end_date), 'MMM d')}`
    : ''

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700">
          <Eye className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Watch List</h3>
        </div>
        <Link to="/alerts" className="text-xs text-navy-600 hover:underline">
          Manage
        </Link>
      </div>
      {periodLabel && (
        <p className="text-xs text-slate-500 mt-1">{periodLabel} vs prior period</p>
      )}

      <div className="mt-4 space-y-3">
        {data.items.slice(0, 5).map((item) => {
          const change = item.revenue_change_pct
          const trendIcon = change == null ? Minus : change >= 0 ? TrendingUp : TrendingDown
          const trendClass = item.status === 'spike'
            ? 'text-emerald-600'
            : item.status === 'drop'
            ? 'text-red-600'
            : item.status === 'new'
            ? 'text-blue-600'
            : 'text-slate-500'
          const TrendIcon = trendIcon

          return (
            <div key={item.id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{item.item_name}</p>
                <p className="text-xs text-slate-500">{formatCurrency(item.revenue, numberFormat)}</p>
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium ${trendClass}`}>
                <TrendIcon className="h-3.5 w-3.5" />
                {change == null ? 'New' : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
