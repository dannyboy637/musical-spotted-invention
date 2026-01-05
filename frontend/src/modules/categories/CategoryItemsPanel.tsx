import { X } from 'lucide-react'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { useMenuEngineering } from '../../hooks/useAnalytics'
import type { MenuEngineeringItem } from '../../hooks/useAnalytics'
import { formatCurrency, quadrantColors } from '../../lib/chartConfig'

interface CategoryItemsPanelProps {
  category: string | null
  onClose: () => void
}

export function CategoryItemsPanel({ category, onClose }: CategoryItemsPanelProps) {
  const { data, isLoading } = useMenuEngineering()

  if (!category) return null

  // Filter items by category
  const categoryItems = (data?.items || [])
    .filter((item) => item.category === category)

  const columns: Column<MenuEngineeringItem>[] = [
    {
      key: 'item_name',
      header: 'Item',
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
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: quadrantColors[quadrant] }}
            />
            {quadrant}
          </span>
        )
      },
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
            <p className="text-sm text-slate-500">{categoryItems.length} items</p>
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
