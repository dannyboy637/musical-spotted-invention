import { Eye, X } from 'lucide-react'
import type { MenuEngineeringItem } from '../../hooks/useAnalytics'
import { formatCurrency, formatCurrencyFull, quadrantColors } from '../../lib/chartConfig'
import { format, parseISO } from 'date-fns'
import { useAddWatchItem, useWatchList } from '../../hooks/useAlerts'
import { useAuthStore } from '../../stores/authStore'
import { Link } from 'react-router-dom'

interface ItemDetailPanelProps {
  item: MenuEngineeringItem | null
  onClose: () => void
}

export function ItemDetailPanel({ item, onClose }: ItemDetailPanelProps) {
  if (!item) return null
  const { profile } = useAuthStore()
  const canManageWatch = profile?.role === 'owner' || profile?.role === 'operator'
  const { data: watchlist } = useWatchList()
  const addWatchMutation = useAddWatchItem()
  const isWatching = !!watchlist?.some((watch) => watch.item_name === item.item_name)

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy')
    } catch {
      return dateStr
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">Item Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Item Name and Quadrant */}
          <div>
            <h3 className="text-xl font-semibold text-navy-900 mb-2">
              {item.item_name}
            </h3>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: `${quadrantColors[item.quadrant]}20`,
                  color: quadrantColors[item.quadrant],
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: quadrantColors[item.quadrant] }}
                />
                {item.quadrant}
              </span>
              <span className="text-sm text-slate-500">{item.category}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {canManageWatch && (
                <button
                  onClick={() => addWatchMutation.mutate({ item_name: item.item_name })}
                  disabled={addWatchMutation.isPending || isWatching}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    addWatchMutation.isPending
                      ? 'border-slate-200 text-slate-400'
                      : isWatching
                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                      : 'border-navy-200 text-navy-700 hover:bg-navy-50'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  {isWatching ? 'Watching' : 'Add to Watch List'}
                </button>
              )}
              <Link to="/alerts" className="text-xs text-slate-500 hover:text-navy-600">
                Manage watch list
              </Link>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 uppercase">Total Revenue</p>
              <p className="text-xl font-semibold text-navy-900 mt-1">
                {formatCurrency(item.total_revenue)}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 uppercase">Quantity Sold</p>
              <p className="text-xl font-semibold text-navy-900 mt-1">
                {item.total_quantity.toLocaleString()}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 uppercase">Average Price</p>
              <p className="text-xl font-semibold text-navy-900 mt-1">
                {formatCurrencyFull(item.avg_price)}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-xs font-medium text-slate-500 uppercase">Order Count</p>
              <p className="text-xl font-semibold text-navy-900 mt-1">
                {item.order_count.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 uppercase">Details</h4>
            <div className="divide-y divide-slate-100">
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Macro Category</span>
                <span className="text-slate-800 font-medium">{item.macro_category}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Core Menu</span>
                <span className="text-slate-800 font-medium">
                  {item.is_core_menu ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Currently Active</span>
                <span className="text-slate-800 font-medium">
                  {item.is_current_menu ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">First Sale</span>
                <span className="text-slate-800 font-medium">
                  {formatDate(item.first_sale_date)}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Last Sale</span>
                <span className="text-slate-800 font-medium">
                  {formatDate(item.last_sale_date)}
                </span>
              </div>
            </div>
          </div>

          {/* Cost Info (if available) */}
          {(item.cost_cents !== null || item.cost_percentage !== null) && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-700 uppercase">Cost Analysis</h4>
              <div className="divide-y divide-slate-100">
                {item.cost_cents !== null && (
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Cost</span>
                    <span className="text-slate-800 font-medium">
                      {formatCurrencyFull(item.cost_cents)}
                    </span>
                  </div>
                )}
                {item.cost_percentage !== null && (
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Cost %</span>
                    <span className="text-slate-800 font-medium">
                      {item.cost_percentage.toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
