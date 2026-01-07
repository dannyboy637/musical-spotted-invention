import { RefreshCw, Database } from 'lucide-react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { MenuEngineeringScatter } from '../../components/charts/MenuEngineeringScatter'
import { useMenuEngineering, useRegenerateMenuItems } from '../../hooks/useAnalytics'
import type { MenuEngineeringItem } from '../../hooks/useAnalytics'

interface QuadrantChartProps {
  selectedQuadrant: string | null
  onItemClick?: (item: MenuEngineeringItem) => void
  macroCategory?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  minQuantity?: number | null
  useLogScale?: boolean
}

export function QuadrantChart({
  selectedQuadrant,
  onItemClick: _onItemClick,
  macroCategory,
  minPrice,
  maxPrice,
  minQuantity,
  useLogScale = false,
}: QuadrantChartProps) {
  const { data, isLoading, error, refetch } = useMenuEngineering({ macroCategory, minPrice, maxPrice, minQuantity })
  const regenerate = useRegenerateMenuItems()

  // Filter items by selected quadrant
  const filteredItems = selectedQuadrant
    ? data?.items.filter((item) => item.quadrant === selectedQuadrant) || []
    : data?.items || []

  // Transform to scatter format
  const scatterData = filteredItems.map((item) => ({
    name: item.item_name,
    quantity: item.total_quantity,
    price: item.avg_price,
    quadrant: item.quadrant,
    revenue: item.total_revenue,
  }))

  const handleRegenerate = async () => {
    try {
      await regenerate.mutateAsync()
    } catch {
      // Error handled by mutation
    }
  }

  // Show regenerate action when empty or on error
  const isEmpty = !isLoading && scatterData.length === 0
  const hasError = !!error

  // Custom empty content with regenerate button
  if (isEmpty && !hasError) {
    return (
      <ChartContainer
        title="Menu Engineering Matrix"
        subtitle="All menu items by popularity and profitability"
        loading={false}
        empty={false}
        skeletonType="scatter"
        height={450}
      >
        <div className="flex flex-col items-center justify-center h-[400px] text-slate-500">
          <Database size={48} strokeWidth={1.5} className="mb-4 text-slate-300" />
          <p className="text-sm text-slate-600 mb-2">No menu items data available</p>
          <p className="text-xs text-slate-400 mb-4 max-w-md text-center">
            Menu items are aggregated from transactions. If you've imported data, click below to regenerate the analytics.
          </p>
          <button
            onClick={handleRegenerate}
            disabled={regenerate.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-navy-600 hover:bg-navy-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={regenerate.isPending ? 'animate-spin' : ''} />
            {regenerate.isPending ? 'Regenerating...' : 'Regenerate Menu Items'}
          </button>
          {regenerate.isSuccess && (
            <p className="mt-3 text-sm text-emerald-600">
              Updated {regenerate.data?.menu_items_updated || 0} menu items
            </p>
          )}
          {regenerate.isError && (
            <p className="mt-3 text-sm text-red-600">
              Error: {(regenerate.error as Error)?.message || 'Failed to regenerate'}
            </p>
          )}
        </div>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer
      title="Menu Engineering Matrix"
      subtitle={selectedQuadrant ? `Showing ${selectedQuadrant} items only` : 'All menu items by popularity and profitability'}
      loading={isLoading}
      empty={false}
      error={error as Error | null}
      onRetry={() => refetch()}
      emptyMessage="No menu items data available"
      skeletonType="scatter"
      height={450}
    >
      <MenuEngineeringScatter
        data={scatterData}
        medianQuantity={data?.median_quantity || 0}
        medianPrice={data?.median_price || 0}
        height={400}
        showQuadrantLabels={!selectedQuadrant}
        useLogScale={useLogScale}
      />
    </ChartContainer>
  )
}
