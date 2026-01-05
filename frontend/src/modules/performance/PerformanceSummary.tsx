import { Calendar } from 'lucide-react'
import { StatCard } from '../../components/ui/StatCard'
import { usePerformance } from '../../hooks/useAnalytics'
import { formatCurrency, formatCurrencyFull } from '../../lib/chartConfig'
import { format, parseISO } from 'date-fns'

export function PerformanceSummary() {
  const { data, isLoading } = usePerformance()

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d')
    } catch {
      return dateStr
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-5 h-5 text-gold-600" />
        <h3 className="text-lg font-semibold text-navy-900">Performance Summary</h3>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Daily Average"
          value={data?.trends.daily_avg ? formatCurrency(data.trends.daily_avg) : '-'}
          loading={isLoading}
        />
        <StatCard
          label="Avg Ticket"
          value={data?.summary.avg_ticket ? formatCurrencyFull(data.summary.avg_ticket) : '-'}
          loading={isLoading}
        />
        <StatCard
          label="Best Day"
          value={data?.trends.best_day ? formatDate(data.trends.best_day.date) : '-'}
          sublabel={data?.trends.best_day ? formatCurrency(data.trends.best_day.revenue) : undefined}
          color="success"
          loading={isLoading}
        />
        <StatCard
          label="Worst Day"
          value={data?.trends.worst_day ? formatDate(data.trends.worst_day.date) : '-'}
          sublabel={data?.trends.worst_day ? formatCurrency(data.trends.worst_day.revenue) : undefined}
          color="warning"
          loading={isLoading}
        />
      </div>
    </div>
  )
}
