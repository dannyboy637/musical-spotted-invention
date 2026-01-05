import { ChartContainer } from '../../components/charts/ChartContainer'
import { Heatmap } from '../../components/charts/Heatmap'
import { useHourlyHeatmap } from '../../hooks/useAnalytics'
import { formatCurrency } from '../../lib/chartConfig'

export function SalesHeatmap() {
  const { data, isLoading, error, refetch } = useHourlyHeatmap()

  // Transform API data to Heatmap format
  const heatmapData = data?.data.map((d) => ({
    day: d.day,
    hour: d.hour,
    value: d.revenue,
  })) || []

  return (
    <ChartContainer
      title="Sales Heatmap"
      subtitle="Revenue by day and hour"
      loading={isLoading}
      empty={heatmapData.length === 0}
      error={error as Error | null}
      onRetry={() => refetch()}
      emptyMessage="No hourly data available"
      skeletonType="heatmap"
      height={320}
    >
      <Heatmap
        data={heatmapData}
        height={280}
        formatValue={formatCurrency}
        valueLabel="Revenue"
      />
    </ChartContainer>
  )
}
