import { useMemo } from 'react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { useMenuEngineering } from '../../hooks/useAnalytics'
import { formatCurrencyFull } from '../../lib/chartConfig'
import { generateMockCosts, calculateMargin, getMarginStatus } from './mockCostData'

interface ItemWithMargin {
  item_name: string
  category: string
  avg_price: number
  cost_cents: number
  margin: number
  total_revenue: number
}

interface TopMarginItemsProps {
  costOverrides: Record<string, number>
  useMockCosts: boolean
}

export function TopMarginItems({ costOverrides, useMockCosts }: TopMarginItemsProps) {
  const { data, isLoading, error, refetch } = useMenuEngineering()

  const items = useMemo<ItemWithMargin[]>(() => {
    if (!data?.items) return []

    const withMockCosts = useMockCosts ? generateMockCosts(data.items) : data.items
    return withMockCosts
      .map((item) => {
        const cost = costOverrides[item.item_name] ?? item.cost_cents ?? 0
        return {
          item_name: item.item_name,
          category: item.category,
          avg_price: item.avg_price,
          cost_cents: cost,
          margin: calculateMargin(item.avg_price, cost),
          total_revenue: item.total_revenue,
        }
      })
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 10)
  }, [data, costOverrides, useMockCosts])

  const columns: Column<ItemWithMargin>[] = [
    {
      key: 'item_name',
      header: 'Item',
      sortable: true,
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
    },
    {
      key: 'avg_price',
      header: 'Price',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrencyFull(value as number),
    },
    {
      key: 'cost_cents',
      header: 'Cost',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrencyFull(value as number),
    },
    {
      key: 'margin',
      header: 'Margin',
      align: 'right',
      sortable: true,
      render: (value) => {
        const margin = value as number
        const status = getMarginStatus(margin)
        return (
          <span
            className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
              status === 'good'
                ? 'bg-emerald-100 text-emerald-700'
                : status === 'warning'
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {margin.toFixed(1)}%
          </span>
        )
      },
    },
  ]

  return (
    <ChartContainer
      title="Top Margin Items"
      subtitle="Highest profit margin items"
      loading={isLoading}
      empty={items.length === 0}
      error={error as Error | null}
      onRetry={() => refetch()}
      emptyMessage="No margin data available"
      skeletonType="bar"
    >
      <div className="px-1">
        <DataTable columns={columns} data={items} keyField="item_name" compact />
      </div>
    </ChartContainer>
  )
}
