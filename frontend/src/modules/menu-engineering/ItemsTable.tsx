import { ChartContainer } from '../../components/charts/ChartContainer'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { useMenuEngineering } from '../../hooks/useAnalytics'
import type { MenuEngineeringItem } from '../../hooks/useAnalytics'
import { formatCurrency, quadrantColors } from '../../lib/chartConfig'

interface ItemsTableProps {
  selectedQuadrant: string | null
  onItemClick: (item: MenuEngineeringItem) => void
  macroCategory?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  minQuantity?: number | null
}

export function ItemsTable({
  selectedQuadrant,
  onItemClick,
  macroCategory,
  minPrice,
  maxPrice,
  minQuantity,
}: ItemsTableProps) {
  const { data, isLoading, error, refetch } = useMenuEngineering({ macroCategory, minPrice, maxPrice, minQuantity })

  // Filter items by selected quadrant
  const filteredItems = selectedQuadrant
    ? data?.items.filter((item) => item.quadrant === selectedQuadrant) || []
    : data?.items || []

  const columns: Column<MenuEngineeringItem>[] = [
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
      key: 'quadrant',
      header: 'Quadrant',
      sortable: true,
      render: (value) => {
        const quadrant = value as keyof typeof quadrantColors
        return (
          <span className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: quadrantColors[quadrant] }}
            />
            {quadrant}
          </span>
        )
      },
    },
    {
      key: 'total_quantity',
      header: 'Qty Sold',
      align: 'right',
      sortable: true,
      render: (value) => (value as number).toLocaleString(),
    },
    {
      key: 'avg_price',
      header: 'Avg Price',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'total_revenue',
      header: 'Revenue',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
  ]

  return (
    <ChartContainer
      title="Menu Items"
      subtitle={`${filteredItems.length} items${selectedQuadrant ? ` in ${selectedQuadrant}` : ''}`}
      loading={isLoading}
      empty={filteredItems.length === 0}
      error={error as Error | null}
      onRetry={() => refetch()}
      emptyMessage="No items match the selected filter"
      skeletonType="bar"
    >
      <div className="px-1 max-h-96 overflow-y-auto">
        <DataTable
          columns={columns}
          data={filteredItems}
          keyField="item_name"
          onRowClick={onItemClick}
          compact
        />
      </div>
    </ChartContainer>
  )
}
