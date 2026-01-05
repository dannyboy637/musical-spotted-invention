import { ChartContainer } from '../../components/charts/ChartContainer'
import { DonutChart } from '../../components/charts/DonutChart'
import { useCategories } from '../../hooks/useAnalytics'
import { formatCurrency, getChartColor } from '../../lib/chartConfig'

interface CategoryBreakdownChartProps {
  selectedMacro: string | null
}

export function CategoryBreakdownChart({ selectedMacro }: CategoryBreakdownChartProps) {
  const { data, isLoading, error, refetch } = useCategories()

  // Filter and transform data for the chart
  const chartData = (data?.categories || [])
    .filter((c) => !selectedMacro || c.macro_category === selectedMacro)
    .slice(0, 10) // Top 10 categories
    .map((c, i) => ({
      name: c.category,
      value: c.revenue,
      color: getChartColor(i),
    }))

  return (
    <ChartContainer
      title="Category Breakdown"
      subtitle={selectedMacro ? `${selectedMacro} categories` : 'Top 10 categories by revenue'}
      loading={isLoading}
      empty={chartData.length === 0}
      error={error as Error | null}
      onRetry={() => refetch()}
      emptyMessage="No category data available"
      skeletonType="donut"
      height={350}
    >
      <DonutChart
        data={chartData}
        height={300}
        formatValue={formatCurrency}
      />
    </ChartContainer>
  )
}
