import { ChartContainer } from '../../components/charts/ChartContainer'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { useMenuEngineering } from '../../hooks/useAnalytics'
import type { MenuEngineeringItem } from '../../hooks/useAnalytics'
import { formatCurrency } from '../../lib/chartConfig'

export function TopItemsTable() {
  const { data, isLoading } = useMenuEngineering()

  // Get top 5 items by revenue (Stars and high performers)
  const topItems = data?.items
    .filter((item) => item.quadrant === 'Star' || item.quadrant === 'Plowhorse')
    .slice(0, 5) || []

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
      key: 'total_quantity',
      header: 'Qty',
      align: 'right',
      sortable: true,
      render: (value) => (value as number).toLocaleString(),
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
      title="Top Performers"
      subtitle="Best selling items by revenue"
      loading={isLoading}
      empty={topItems.length === 0}
      emptyMessage="No items data available"
      skeletonType="bar"
    >
      <div className="px-1">
        <DataTable
          columns={columns}
          data={topItems}
          keyField="item_name"
          compact
          emptyMessage="No top performers found"
        />
      </div>
    </ChartContainer>
  )
}
