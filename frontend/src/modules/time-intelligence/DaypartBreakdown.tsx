import { ChartContainer } from '../../components/charts/ChartContainer'
import { BarChart } from '../../components/charts/BarChart'
import { useDayparting } from '../../hooks/useAnalytics'
import { formatCurrency, chartColors } from '../../lib/chartConfig'

const daypartLabels: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  late_night: 'Late Night',
}

const daypartOrder = ['breakfast', 'lunch', 'dinner', 'late_night']

export function DaypartBreakdown() {
  const { data, isLoading } = useDayparting()

  // Transform and sort data for the chart
  const chartData = data?.dayparts
    .sort((a, b) => daypartOrder.indexOf(a.daypart) - daypartOrder.indexOf(b.daypart))
    .map((d) => ({
      name: daypartLabels[d.daypart] || d.daypart,
      revenue: d.revenue,
      percentage: d.percentage_of_total,
    })) || []

  return (
    <ChartContainer
      title="Daypart Breakdown"
      subtitle="Revenue by time of day"
      loading={isLoading}
      empty={chartData.length === 0}
      emptyMessage="No daypart data available"
      skeletonType="bar"
      height={300}
    >
      <BarChart
        data={chartData}
        xKey="name"
        bars={[{ key: 'revenue', name: 'Revenue', color: chartColors[0] }]}
        formatY={formatCurrency}
        height={260}
        colorByIndex
      />
    </ChartContainer>
  )
}
