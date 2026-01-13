import type { LucideIcon } from 'lucide-react'
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string
  tooltip?: string
  change?: number | null
  changeLabel?: string
  icon?: LucideIcon
  loading?: boolean
}

export function KPICard({
  title,
  value,
  tooltip,
  change,
  changeLabel = 'vs prev period',
  icon: Icon,
  loading = false,
}: KPICardProps) {
  const getChangeColor = () => {
    if (change === null || change === undefined) return 'text-slate-500'
    if (change > 0) return 'text-emerald-600'
    if (change < 0) return 'text-red-600'
    return 'text-slate-500'
  }

  const getChangeIcon = () => {
    if (change === null || change === undefined) return null
    if (change > 0) return <TrendingUp className="w-4 h-4" />
    if (change < 0) return <TrendingDown className="w-4 h-4" />
    return <Minus className="w-4 h-4" />
  }

  const formatChange = () => {
    if (change === null || change === undefined) return null
    const sign = change > 0 ? '+' : ''
    return `${sign}${change.toFixed(1)}%`
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-3"></div>
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 sm:p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{title}</p>
            {tooltip && (
              <span className="group relative">
                <Info className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" />
                <span className="invisible group-hover:visible absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 text-xs text-white bg-slate-800 rounded-lg whitespace-normal w-48 text-center shadow-lg z-10">
                  {tooltip}
                  <span className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-800" />
                </span>
              </span>
            )}
          </div>
          <p className="mt-1 text-2xl sm:text-3xl font-semibold text-navy-900 dark:text-white truncate">{value}</p>
          {change !== undefined && (
            <div className={`mt-2 flex items-center gap-1 text-sm ${getChangeColor()}`}>
              {getChangeIcon()}
              <span className="font-medium">{formatChange()}</span>
              <span className="text-slate-400 hidden sm:inline">{changeLabel}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="flex-shrink-0 p-2 bg-navy-50 dark:bg-navy-900 rounded-lg">
            <Icon className="w-6 h-6 text-navy-600 dark:text-navy-300" />
          </div>
        )}
      </div>
    </div>
  )
}
