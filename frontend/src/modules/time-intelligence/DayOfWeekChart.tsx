import { useMemo } from 'react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { BarChart } from '../../components/charts/BarChart'
import { useHourlyHeatmap } from '../../hooks/useAnalytics'
import { formatCurrency, dayLabels, chartColors } from '../../lib/chartConfig'

export function DayOfWeekChart() {
  const { data, isLoading } = useHourlyHeatmap()

  // Aggregate heatmap data by day
  const chartData = useMemo(() => {
    if (!data?.data) return []

    const dayTotals = new Map<number, number>()

    data.data.forEach((d) => {
      const current = dayTotals.get(d.day) || 0
      dayTotals.set(d.day, current + d.revenue)
    })

    return Array.from({ length: 7 }, (_, i) => ({
      name: dayLabels[i],
      revenue: dayTotals.get(i) || 0,
    }))
  }, [data])

  return (
    <ChartContainer
      title="Day of Week"
      subtitle="Revenue by day"
      loading={isLoading}
      empty={chartData.length === 0 || chartData.every((d) => d.revenue === 0)}
      emptyMessage="No daily data available"
      skeletonType="bar"
      height={300}
    >
      <BarChart
        data={chartData}
        xKey="name"
        bars={[{ key: 'revenue', name: 'Revenue', color: chartColors[1] }]}
        formatY={formatCurrency}
        height={260}
      />
    </ChartContainer>
  )
}
