import { TrendingUp, TrendingDown } from 'lucide-react'
import { usePerformanceTrends } from '../../hooks/useAnalytics'

export function GrowthMetrics() {
  const { data, isLoading } = usePerformanceTrends()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-24 mb-2" />
            <div className="h-8 bg-slate-200 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  const wow = data?.growth_metrics?.week_over_week
  const mom = data?.growth_metrics?.month_over_month

  const renderGrowth = (value: number | null | undefined, label: string) => {
    if (value === null || value === undefined) {
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <p className="text-xs font-medium text-slate-500 uppercase">{label}</p>
          <p className="text-xl font-semibold text-slate-400 mt-1">-</p>
          <p className="text-xs text-slate-400 mt-1">Not enough data</p>
        </div>
      )
    }

    const isPositive = value >= 0
    const Icon = isPositive ? TrendingUp : TrendingDown
    const colorClass = isPositive ? 'text-emerald-600' : 'text-red-600'
    const bgClass = isPositive ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'

    return (
      <div className={`border rounded-lg p-4 ${bgClass}`}>
        <p className="text-xs font-medium text-slate-500 uppercase">{label}</p>
        <div className="flex items-center gap-2 mt-1">
          <Icon className={`w-5 h-5 ${colorClass}`} />
          <span className={`text-xl font-semibold ${colorClass}`}>
            {isPositive ? '+' : ''}{value.toFixed(1)}%
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {renderGrowth(wow, 'Week over Week')}
      {renderGrowth(mom, 'Month over Month')}
    </div>
  )
}
