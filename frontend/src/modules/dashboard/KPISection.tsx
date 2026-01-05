import { DollarSign, Receipt, ShoppingBag, TrendingUp, Calendar, Percent } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { KPICard } from '../../components/ui/KPICard'
import { useOverview, usePerformance } from '../../hooks/useAnalytics'
import { formatCurrency, formatCurrencyFull } from '../../lib/chartConfig'
import { useSettingsStore } from '../../stores/settingsStore'

interface KPIConfig {
  id: string
  title: string
  icon: LucideIcon
  getValue: (data: ReturnType<typeof useOverview>['data'], perfData: ReturnType<typeof usePerformance>['data']) => string
  getChange?: (data: ReturnType<typeof useOverview>['data']) => number | null | undefined
}

const ALL_KPIS: KPIConfig[] = [
  {
    id: 'revenue',
    title: 'Total Revenue',
    icon: DollarSign,
    getValue: (data) => data ? formatCurrency(data.total_revenue) : '-',
    getChange: (data) => data?.period_growth,
  },
  {
    id: 'transactions',
    title: 'Transactions',
    icon: Receipt,
    getValue: (data) => data ? data.total_transactions.toLocaleString() : '-',
  },
  {
    id: 'avgTicket',
    title: 'Avg Ticket',
    icon: ShoppingBag,
    getValue: (data) => data ? formatCurrencyFull(data.avg_ticket) : '-',
  },
  {
    id: 'uniqueItems',
    title: 'Unique Items',
    icon: TrendingUp,
    getValue: (data) => data ? data.unique_items.toLocaleString() : '-',
  },
  {
    id: 'growth',
    title: 'Growth %',
    icon: Percent,
    getValue: (data) => data?.period_growth != null ? `${data.period_growth > 0 ? '+' : ''}${data.period_growth.toFixed(1)}%` : 'N/A',
  },
  {
    id: 'bestDay',
    title: 'Best Day',
    icon: Calendar,
    getValue: (_, perfData) => perfData?.trends?.best_day ? formatCurrency(perfData.trends.best_day.revenue) : '-',
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
          value={kpi.getValue(data, perfData)}
          change={kpi.getChange?.(data)}
          icon={kpi.icon}
          loading={isLoading || (kpi.id === 'bestDay' && perfLoading)}
        />
      ))}
    </div>
  )
}
