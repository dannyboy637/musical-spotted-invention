import { useMemo } from 'react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { DonutChart } from '../../components/charts/DonutChart'
import { useMenuEngineering } from '../../hooks/useAnalytics'
import { generateMockCosts, calculateMargin, getMarginStatus } from './mockCostData'

interface MarginAnalysisProps {
  costOverrides: Record<string, number>
  useMockCosts: boolean
}

export function MarginAnalysis({ costOverrides, useMockCosts }: MarginAnalysisProps) {
  const { data, isLoading, error, refetch } = useMenuEngineering()

  const marginDistribution = useMemo(() => {
    if (!data?.items) return []

    const withMockCosts = useMockCosts ? generateMockCosts(data.items) : data.items
    const items = withMockCosts.map((item) => ({
      ...item,
      cost_cents: costOverrides[item.item_name] ?? item.cost_cents,
    }))

    let good = 0
    let warning = 0
    let danger = 0

    items.forEach((item) => {
      const margin = calculateMargin(item.avg_price, item.cost_cents || 0)
      const status = getMarginStatus(margin)
      if (status === 'good') good++
      else if (status === 'warning') warning++
      else danger++
    })

    return [
      { name: 'Good (60%+)', value: good, color: '#10b981' },
      { name: 'Warning (50-60%)', value: warning, color: '#f59e0b' },
      { name: 'Low (<50%)', value: danger, color: '#ef4444' },
    ]
  }, [data?.items, costOverrides, useMockCosts])

  return (
    <ChartContainer
      title="Margin Distribution"
      subtitle="Items by margin health"
      loading={isLoading}
      empty={marginDistribution.every((d) => d.value === 0)}
      error={error as Error | null}
      onRetry={() => refetch()}
      emptyMessage="No margin data available"
      skeletonType="donut"
      height={300}
    >
      <DonutChart
        data={marginDistribution}
        height={250}
        formatValue={(v) => `${v} items`}
      />
    </ChartContainer>
  )
}
