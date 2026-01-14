import { DollarSign, Receipt, ShoppingBag, TrendingUp, Calendar, Percent } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { KPICard } from '../../components/ui/KPICard'
import { useOverview, usePerformance } from '../../hooks/useAnalytics'
import { formatCurrency, formatCurrencyFull } from '../../lib/chartConfig'
import { useSettingsStore } from '../../stores/settingsStore'

interface KPIConfig {
  id: string
  title: string
  tooltip: string
  icon: LucideIcon
  getValue: (data: ReturnType<typeof useOverview>['data'], perfData: ReturnType<typeof usePerformance>['data']) => string
  getChange?: (data: ReturnType<typeof useOverview>['data']) => number | null | undefined
  getSubtitle?: (data: ReturnType<typeof useOverview>['data'], perfData: ReturnType<typeof usePerformance>['data']) => string | undefined
}

const ALL_KPIS: KPIConfig[] = [
  {
    id: 'revenue',
    title: 'Total Revenue',
    tooltip: 'Total gross revenue from all sales in the selected period.',
    icon: DollarSign,
    getValue: (data) => data ? formatCurrency(data.total_revenue) : '-',
    getChange: (data) => data?.period_growth,
  },
  {
    id: 'transactions',
    title: 'Transactions',
    tooltip: 'Number of individual line items sold across all receipts.',
    icon: Receipt,
    getValue: (data) => data ? data.total_transactions.toLocaleString() : '-',
  },
  {
    id: 'avgTicket',
    title: 'Avg Ticket',
    tooltip: 'Average revenue per receipt. Calculated as total revenue divided by number of receipts.',
    icon: ShoppingBag,
    getValue: (data) => data ? formatCurrencyFull(data.avg_ticket) : '-',
  },
  {
    id: 'uniqueItems',
    title: 'Unique Items',
    tooltip: 'Number of distinct menu items sold in the selected period.',
    icon: TrendingUp,
    getValue: (data) => data ? data.unique_items.toLocaleString() : '-',
  },
  {
    id: 'growth',
    title: 'Growth %',
    tooltip: 'Revenue change compared to the previous period of equal length.',
    icon: Percent,
    getValue: (data) => data?.period_growth != null ? `${data.period_growth > 0 ? '+' : ''}${data.period_growth.toFixed(1)}%` : 'N/A',
  },
  {
    id: 'bestDay',
    title: 'Best Day',
    tooltip: 'Highest single-day revenue in the selected period.',
    icon: Calendar,
    getValue: (_, perfData) => perfData?.trends?.best_day ? formatCurrency(perfData.trends.best_day.revenue) : '-',
    getSubtitle: (_, perfData) => {
      if (!perfData?.trends?.best_day) return undefined
      const { date, revenue } = perfData.trends.best_day
      const dailyAvg = perfData.trends.daily_avg
      const formattedDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      if (dailyAvg > 0) {
        const aboveAvg = Math.round(((revenue - dailyAvg) / dailyAvg) * 100)
        return `${formattedDate} • ${aboveAvg}% above avg`
      }
      return formattedDate
    },
  },
]

export function KPISection() {
  const { data, isLoading } = useOverview()
  const { data: perfData, isLoading: perfLoading } = usePerformance()
  const { enabledKPIs } = useSettingsStore()

  // Filter and order KPIs based on settings
  const displayKPIs = enabledKPIs
    .map((id) => ALL_KPIS.find((kpi) => kpi.id === id))
    .filter((kpi): kpi is KPIConfig => kpi !== undefined)

  // Determine grid columns based on KPI count
  const gridCols = displayKPIs.length <= 2
    ? 'grid-cols-1 sm:grid-cols-2'
    : displayKPIs.length === 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'

  return (
    <div className={`grid ${gridCols} gap-4`}>
      {displayKPIs.map((kpi) => (
        <KPICard
          key={kpi.id}
          title={kpi.title}
          tooltip={kpi.tooltip}
          value={kpi.getValue(data, perfData)}
          subtitle={kpi.getSubtitle?.(data, perfData)}
          change={kpi.getChange?.(data)}
          icon={kpi.icon}
          loading={isLoading || (kpi.id === 'bestDay' && perfLoading)}
        />
      ))}
    </div>
  )
}
