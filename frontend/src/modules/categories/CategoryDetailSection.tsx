import { useMemo } from 'react'
import { MousePointer, TrendingUp, TrendingDown, Flame, AlertTriangle } from 'lucide-react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { DonutChart } from '../../components/charts/DonutChart'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { useCategoryItems } from '../../hooks/useAnalytics'
import type { CategoryItemData } from '../../hooks/useAnalytics'
import { formatCurrency, getChartColor } from '../../lib/chartConfig'
import { useFilterStore } from '../../stores/filterStore'

interface CategoryDetailSectionProps {
  selectedCategory: string | null
}

export function CategoryDetailSection({ selectedCategory }: CategoryDetailSectionProps) {
  const { data, isLoading, error, refetch } = useCategoryItems(selectedCategory)
  const { branches } = useFilterStore()

  // Calculate top/bottom performers
  const { topRevenueItems, bottomRevenueItems, topQuantityItems, bottomQuantityItems } = useMemo(() => {
    if (!data?.items || data.items.length < 6) {
      return {
        topRevenueItems: new Set<string>(),
        bottomRevenueItems: new Set<string>(),
        topQuantityItems: new Set<string>(),
        bottomQuantityItems: new Set<string>(),
      }
    }

    const sortedByRevenue = [...data.items].sort((a, b) => b.revenue - a.revenue)
    const sortedByQuantity = [...data.items].sort((a, b) => b.quantity - a.quantity)

    return {
      topRevenueItems: new Set(sortedByRevenue.slice(0, 3).map((i) => i.item_name)),
      bottomRevenueItems: new Set(sortedByRevenue.slice(-3).map((i) => i.item_name)),
      topQuantityItems: new Set(sortedByQuantity.slice(0, 3).map((i) => i.item_name)),
      bottomQuantityItems: new Set(sortedByQuantity.slice(-3).map((i) => i.item_name)),
    }
  }, [data?.items])

  // Transform data for pie chart
  const chartData = useMemo(() => {
    if (!data?.items) return []
    return data.items.slice(0, 10).map((item, i) => ({
      name: item.item_name,
      value: item.revenue,
      color: getChartColor(i),
    }))
  }, [data?.items])

  // Render performance badges
  const renderPerformanceBadges = (itemName: string) => {
    const badges = []

    if (topRevenueItems.has(itemName)) {
      badges.push(
        <span
          key="top-rev"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded"
        >
          <Flame size={10} />
          Top Revenue
        </span>
      )
    }
    if (topQuantityItems.has(itemName) && !topRevenueItems.has(itemName)) {
      badges.push(
        <span
          key="top-qty"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 text-blue-700 rounded"
        >
          <TrendingUp size={10} />
          Top Seller
        </span>
      )
    }
    if (bottomRevenueItems.has(itemName) && !topRevenueItems.has(itemName)) {
      badges.push(
        <span
          key="low-rev"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded"
        >
          <AlertTriangle size={10} />
          Low Revenue
        </span>
      )
    }
    if (bottomQuantityItems.has(itemName) && !bottomRevenueItems.has(itemName) && !topQuantityItems.has(itemName)) {
      badges.push(
        <span
          key="slow"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded"
        >
          <TrendingDown size={10} />
          Slow Mover
        </span>
      )
    }

    return badges.length > 0 ? <div className="flex flex-wrap gap-1 mt-1">{badges}</div> : null
  }

  const columns: Column<CategoryItemData>[] = [
    {
      key: 'item_name',
      header: 'Item',
      sortable: true,
      render: (value) => (
        <div>
          <span className="font-medium">{value as string}</span>
          {renderPerformanceBadges(value as string)}
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Qty Sold',
      align: 'right',
      sortable: true,
      render: (value) => (value as number).toLocaleString(),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'avg_price',
      header: 'Avg Price',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'percentage_of_category',
      header: '% of Category',
      align: 'right',
      sortable: true,
      render: (value) => `${(value as number).toFixed(1)}%`,
    },
  ]

  // Empty state when no category selected
  if (!selectedCategory) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-12 text-center">
        <MousePointer className="mx-auto h-8 w-8 text-slate-400 mb-3" />
        <p className="text-slate-600 font-medium">Click a category above for detailed breakdown</p>
        <p className="text-sm text-slate-500 mt-1">View items, performance metrics, and trends</p>
      </div>
    )
  }

  const items = data?.items || []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-navy-900">{selectedCategory}</h3>
          <p className="text-sm text-slate-500">
            {items.length} items
            {data?.total_revenue ? ` · ${formatCurrency(data.total_revenue)} total revenue` : ''}
            {branches.length > 0 && ` · ${branches.length === 1 ? branches[0] : `${branches.length} branches`}`}
          </p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Drill-down Pie Chart */}
        <ChartContainer
          title="Item Breakdown"
          subtitle={`Top ${Math.min(10, items.length)} items by revenue`}
          loading={isLoading}
          empty={chartData.length === 0}
          error={error as Error | null}
          onRetry={() => refetch()}
          emptyMessage="No items found"
          skeletonType="donut"
          height={300}
        >
          <DonutChart data={chartData} height={280} formatValue={formatCurrency} />
        </ChartContainer>

        {/* Items Table */}
        <ChartContainer
          title="All Items"
          subtitle={`${items.length} items in ${selectedCategory}`}
          loading={isLoading}
          empty={items.length === 0}
          error={error as Error | null}
          onRetry={() => refetch()}
          emptyMessage="No items found"
          skeletonType="bar"
        >
          <div className="max-h-72 overflow-y-auto">
            <DataTable columns={columns} data={items} keyField="item_name" compact />
          </div>
        </ChartContainer>
      </div>
    </div>
  )
}
