import { ChartContainer } from '../../components/charts/ChartContainer'
import { BarChart } from '../../components/charts/BarChart'
import { usePerformanceBranches } from '../../hooks/useAnalytics'
import { formatCurrency, chartColors } from '../../lib/chartConfig'

export function BranchRevenueChart() {
  const { data, isLoading } = usePerformanceBranches()

  const chartData = (data?.branches || []).map((b) => ({
    name: b.name,
    revenue: b.revenue,
  }))

  return (
    <ChartContainer
      title="Revenue by Branch"
      subtitle="Total revenue comparison"
      loading={isLoading}
      empty={chartData.length === 0}
      emptyMessage="No branch data available"
      skeletonType="bar"
      height={350}
    >
      <BarChart
        data={chartData}
        xKey="name"
        bars={[{ key: 'revenue', name: 'Revenue', color: chartColors[0] }]}
        layout="horizontal"
        formatY={formatCurrency}
        height={300}
      />
    </ChartContainer>
  )
}
