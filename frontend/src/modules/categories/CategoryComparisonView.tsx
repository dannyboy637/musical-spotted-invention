import { useMemo } from 'react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { DonutChart } from '../../components/charts/DonutChart'
import { useCategories, useCategoryItems } from '../../hooks/useAnalytics'
import { formatCurrency, getChartColor } from '../../lib/chartConfig'

interface CategoryComparisonViewProps {
  selectedCategories: string[]
}

export function CategoryComparisonView({ selectedCategories }: CategoryComparisonViewProps) {
  const { data: categoriesData, isLoading: categoriesLoading } = useCategories()

  // Get data for each selected category
  const categoryMetrics = useMemo(() => {
    if (!categoriesData?.categories) return []
    return selectedCategories
      .map((name) => categoriesData.categories.find((c) => c.category === name))
      .filter(Boolean)
  }, [categoriesData, selectedCategories])

  if (selectedCategories.length < 2) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-12 text-center">
        <p className="text-slate-600 font-medium">Select 2 or more categories to compare</p>
        <p className="text-sm text-slate-500 mt-1">Click categories in the table above (max 4)</p>
      </div>
    )
  }

  if (categoriesLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="h-40 bg-slate-100 rounded" />
        </div>
      </div>
    )
  }

  // Calculate comparison metrics
  const metrics = [
    { label: 'Revenue', key: 'revenue', format: formatCurrency },
    { label: 'Qty Sold', key: 'quantity', format: (v: number) => v.toLocaleString() },
    { label: 'Avg Price', key: 'avg_price', format: formatCurrency },
    { label: '# Items', key: 'item_count', format: (v: number) => v.toString() },
    { label: '% of Total', key: 'percentage_of_revenue', format: (v: number) => `${v.toFixed(1)}%` },
  ]

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-navy-900">
        Comparing: {selectedCategories.join(' vs ')}
      </h3>

      {/* Comparison Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Metric
              </th>
              {categoryMetrics.map((cat, i) => (
                <th
                  key={cat?.category}
                  className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider"
                  style={{ color: getChartColor(i) }}
                >
                  {cat?.category}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {metrics.map((metric) => (
              <tr key={metric.key}>
                <td className="px-4 py-3 text-sm text-slate-600">{metric.label}</td>
                {categoryMetrics.map((cat) => {
                  const value = cat?.[metric.key as keyof typeof cat] as number
                  return (
                    <td key={cat?.category} className="px-4 py-3 text-sm text-right font-medium text-slate-800">
                      {metric.format(value || 0)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Side-by-side item breakdowns */}
      <div className={`grid gap-4 ${selectedCategories.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
        {selectedCategories.map((category, index) => (
          <CategoryItemsChart key={category} category={category} colorIndex={index} />
        ))}
      </div>
    </div>
  )
}

// Sub-component for individual category item breakdown
function CategoryItemsChart({ category, colorIndex }: { category: string; colorIndex: number }) {
  const { data, isLoading, error, refetch } = useCategoryItems(category)

  const chartData = useMemo(() => {
    if (!data?.items) return []
    return data.items.slice(0, 5).map((item) => ({
      name: item.item_name,
      value: item.revenue,
      color: getChartColor(colorIndex), // Use category color for all items
    }))
  }, [data?.items, colorIndex])

  return (
    <ChartContainer
      title={category}
      subtitle={`Top 5 items`}
      loading={isLoading}
      empty={chartData.length === 0}
      error={error as Error | null}
      onRetry={() => refetch()}
      emptyMessage="No items"
      skeletonType="donut"
      height={200}
    >
      <DonutChart
        data={chartData}
        height={180}
        innerRadius={30}
        outerRadius={50}
        showLegend={false}
        formatValue={formatCurrency}
      />
    </ChartContainer>
  )
}
