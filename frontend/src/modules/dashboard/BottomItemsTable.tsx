import { ChartContainer } from '../../components/charts/ChartContainer'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { useMenuEngineering } from '../../hooks/useAnalytics'
import type { MenuEngineeringItem } from '../../hooks/useAnalytics'
import { formatCurrency } from '../../lib/chartConfig'

export function BottomItemsTable() {
  const { data, isLoading } = useMenuEngineering()

  // Get bottom 5 items (Dogs quadrant)
  const bottomItems = data?.items
    .filter((item) => item.quadrant === 'Dog')
    .slice(-5)
    .reverse() || []

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
      title="Underperformers"
      subtitle="Items in the Dog quadrant"
      loading={isLoading}
      empty={bottomItems.length === 0}
      emptyMessage="No underperforming items"
      emptyDescription="Great news! No items are currently in the Dog quadrant."
      skeletonType="bar"
    >
      <div className="px-1">
        <DataTable
          columns={columns}
          data={bottomItems}
          keyField="item_name"
          compact
          emptyMessage="No underperformers found"
        />
      </div>
    </ChartContainer>
  )
}
