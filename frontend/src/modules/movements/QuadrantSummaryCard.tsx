import { Star, TrendingUp, HelpCircle, AlertTriangle } from 'lucide-react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { useQuadrantTimeline } from '../../hooks/useAnalytics'

const QUADRANT_CONFIG = {
  Star: {
    icon: Star,
    color: 'text-gold-600',
    bg: 'bg-gold-50',
    border: 'border-gold-200',
    description: 'High popularity + High profitability',
  },
  Plowhorse: {
    icon: TrendingUp,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    description: 'High popularity + Low profitability',
  },
  Puzzle: {
    icon: HelpCircle,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    description: 'Low popularity + High profitability',
  },
  Dog: {
    icon: AlertTriangle,
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    description: 'Low popularity + Low profitability',
  },
} as const

export function QuadrantSummaryCard() {
  const { data, isLoading } = useQuadrantTimeline()

  const quadrants = [
    { key: 'Star', count: data?.summary.star_count ?? 0 },
    { key: 'Plowhorse', count: data?.summary.plowhorse_count ?? 0 },
    { key: 'Puzzle', count: data?.summary.puzzle_count ?? 0 },
    { key: 'Dog', count: data?.summary.dog_count ?? 0 },
  ] as const

  const totalItems = data?.summary.total_items ?? 0

  return (
    <ChartContainer
      title="Current Quadrant Distribution"
      subtitle="Overview of menu items by performance quadrant"
      loading={isLoading}
      empty={!data || totalItems === 0}
      emptyDescription="No menu items found with performance data."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quadrants.map(({ key, count }) => {
          const config = QUADRANT_CONFIG[key]
          const Icon = config.icon
          const percentage = totalItems > 0 ? ((count / totalItems) * 100).toFixed(0) : '0'

          return (
            <div
              key={key}
              className={`rounded-lg border p-4 ${config.bg} ${config.border}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-5 w-5 ${config.color}`} />
                <span className={`font-medium ${config.color}`}>{key}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">{count}</span>
                <span className="text-sm text-slate-500">items ({percentage}%)</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{config.description}</p>
            </div>
          )
        })}
      </div>

      {/* Top movers section */}
      {data?.movements && data.movements.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-200">
          <h4 className="text-sm font-medium text-slate-700 mb-3">Top Items by Revenue</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.movements.slice(0, 6).map((item) => {
              const config = QUADRANT_CONFIG[item.quadrant as keyof typeof QUADRANT_CONFIG]
              return (
                <div
                  key={item.item_name}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.item_name}</p>
                    <p className="text-xs text-slate-500">
                      {(item.total_revenue / 100).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${config.bg} ${config.color} font-medium`}>
                    {item.quadrant}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {data?.changes && data.changes.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 className="text-sm font-medium text-slate-700">Recent Quadrant Shifts</h4>
            {data.latest_month && data.prior_month && (
              <span className="text-xs text-slate-500">
                {data.prior_month} → {data.latest_month}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.changes.slice(0, 6).map((change) => (
              <div
                key={`${change.item_name}-${change.change}`}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{change.item_name}</p>
                  <p className="text-xs text-slate-500">{change.change}</p>
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  {(change.total_revenue / 100).toLocaleString('en-PH', {
                    style: 'currency',
                    currency: 'PHP',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartContainer>
  )
}
