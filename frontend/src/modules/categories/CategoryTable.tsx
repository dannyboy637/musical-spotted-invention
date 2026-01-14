import { ChartContainer } from '../../components/charts/ChartContainer'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { useCategories } from '../../hooks/useAnalytics'
import type { CategoryData } from '../../hooks/useAnalytics'
import { formatCurrency, formatPercent } from '../../lib/chartConfig'
import type { ViewMode } from './CategoryPage'

interface CategoryTableProps {
  selectedMacro: string | null
  onCategoryClick: (category: CategoryData) => void
  selectedCategories?: string[]
  viewMode?: ViewMode
}

export function CategoryTable({
  selectedMacro,
  onCategoryClick,
  selectedCategories = [],
  viewMode = 'single',
}: CategoryTableProps) {
  // Silence unused warning - will be used for checkbox mode
  void viewMode
  const { data, isLoading, error, refetch } = useCategories()

  // Filter by selected macro
  const filteredCategories = (data?.categories || [])
    .filter((c) => !selectedMacro || c.macro_category === selectedMacro)

  const columns: Column<CategoryData>[] = [
    {
      key: 'category',
      header: 'Category',
      sortable: true,
    },
    {
      key: 'macro_category',
      header: 'Type',
      sortable: true,
    },
    {
      key: 'item_count',
      header: 'Items',
      align: 'right',
      sortable: true,
    },
    {
      key: 'quantity',
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
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'percentage_of_revenue',
      header: '% of Total',
      align: 'right',
      sortable: true,
      render: (value) => formatPercent(value as number),
    },
  ]

  return (
    <ChartContainer
      title="Categories"
      subtitle={`${filteredCategories.length} categories${selectedMacro ? ` in ${selectedMacro}` : ''}`}
      loading={isLoading}
      empty={filteredCategories.length === 0}
      error={error as Error | null}
      onRetry={() => refetch()}
      emptyMessage="No categories found"
      skeletonType="bar"
    >
      <div className="px-1 max-h-96 overflow-y-auto">
        <DataTable
          columns={columns}
          data={filteredCategories}
          keyField="category"
          onRowClick={onCategoryClick}
          compact
          rowClassName={(row) =>
            selectedCategories.includes(row.category)
              ? 'bg-navy-50 border-l-2 border-l-navy-500'
              : ''
          }
        />
      </div>
    </ChartContainer>
  )
}
