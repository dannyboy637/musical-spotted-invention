import { useMemo } from 'react'
import { Clock } from 'lucide-react'
import { StatCard } from '../../components/ui/StatCard'
import { useDayparting, useHourlyHeatmap } from '../../hooks/useAnalytics'
import { hourLabels, dayLabels } from '../../lib/chartConfig'

const daypartLabels: Record<string, string> = {
  breakfast: 'Breakfast (6-11am)',
  lunch: 'Lunch (11am-3pm)',
  dinner: 'Dinner (3-9pm)',
  late_night: 'Late Night (9pm-6am)',
}

export function PeakTimesCard() {
  const { data: daypartData, isLoading: daypartLoading } = useDayparting()
  const { data: heatmapData, isLoading: heatmapLoading } = useHourlyHeatmap()

  const isLoading = daypartLoading || heatmapLoading

  // Find peak hour from heatmap data
  const peakHour = useMemo(() => {
    if (!heatmapData?.data?.length) return null

    let maxRevenue = 0
    let peakData = { day: 0, hour: 0 }

    heatmapData.data.forEach((d) => {
      if (d.revenue > maxRevenue) {
        maxRevenue = d.revenue
        peakData = { day: d.day, hour: d.hour }
      }
    })

    return {
      time: hourLabels[peakData.hour],
      day: dayLabels[peakData.day],
    }
  }, [heatmapData])

  // Peak daypart from dayparting data
  const peakDaypart = daypartData?.peak_daypart
    ? daypartLabels[daypartData.peak_daypart] || daypartData.peak_daypart
    : null

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-gold-600" />
        <h3 className="text-lg font-semibold text-navy-900">Peak Times</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Peak Daypart"
          value={peakDaypart || '-'}
          color="info"
          loading={isLoading}
        />
        <StatCard
          label="Busiest Hour"
          value={peakHour ? `${peakHour.day} ${peakHour.time}` : '-'}
          color="success"
          loading={isLoading}
        />
      </div>
    </div>
  )
}
