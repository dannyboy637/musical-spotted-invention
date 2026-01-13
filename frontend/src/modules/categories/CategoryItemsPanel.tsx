import { X, Store } from 'lucide-react'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { useCategoryItems } from '../../hooks/useAnalytics'
import type { CategoryItemData } from '../../hooks/useAnalytics'
import { formatCurrency } from '../../lib/chartConfig'
import { useFilterStore } from '../../stores/filterStore'

interface CategoryItemsPanelProps {
  category: string | null
  onClose: () => void
}

export function CategoryItemsPanel({ category, onClose }: CategoryItemsPanelProps) {
  const { data, isLoading } = useCategoryItems(category)
  const { branches } = useFilterStore()

  if (!category) return null

  const categoryItems = data?.items || []

  const columns: Column<CategoryItemData>[] = [
    {
      key: 'item_name',
      header: 'Item',
      sortable: true,
    },
    {
      key: 'quantity',
      header: 'Qty',
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

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white shadow-xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">{category}</h2>
            <p className="text-sm text-slate-500">
              {categoryItems.length} items
              {data?.total_revenue ? ` · ${formatCurrency(data.total_revenue)} total` : ''}
            </p>
            {branches.length > 0 && (
              <p className="text-xs text-navy-600 mt-1 flex items-center gap-1">
                <Store size={12} />
                {branches.length === 1 ? branches[0] : `${branches.length} branches selected`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded" />
              ))}
            </div>
          ) : categoryItems.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No items in this category</p>
          ) : (
            <DataTable
              columns={columns}
              data={categoryItems}
              keyField="item_name"
              compact
            />
          )}
        </div>
      </div>
    </>
  )
}
