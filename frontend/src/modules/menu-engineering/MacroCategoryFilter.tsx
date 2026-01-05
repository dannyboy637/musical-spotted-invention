import { useCategories } from '../../hooks/useAnalytics'
import {
  UtensilsCrossed,
  Wine,
  Coffee,
  Cake,
  ShoppingBag,
  Package,
  LayoutGrid,
} from 'lucide-react'

const MACRO_CATEGORIES = [
  { key: 'FOOD', label: 'Food', icon: UtensilsCrossed, color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { key: 'BEVERAGE', label: 'Beverage', icon: Coffee, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'ALCOHOL', label: 'Alcohol', icon: Wine, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: 'SWEETS', label: 'Sweets', icon: Cake, color: 'bg-pink-100 text-pink-700 border-pink-200' },
  { key: 'RETAIL', label: 'Retail', icon: ShoppingBag, color: 'bg-teal-100 text-teal-700 border-teal-200' },
  { key: 'OTHER', label: 'Other', icon: Package, color: 'bg-slate-100 text-slate-700 border-slate-200' },
]

interface MacroCategoryFilterProps {
  selectedCategory: string | null
  onCategoryChange: (category: string | null) => void
}

export function MacroCategoryFilter({
  selectedCategory,
  onCategoryChange,
}: MacroCategoryFilterProps) {
  const { data: categoriesData } = useCategories()

  // Get counts from macro_totals
  const macroCounts = categoriesData?.macro_totals || {}

  // Check if "ALL" is selected
  const isAllSelected = selectedCategory === null || selectedCategory === 'ALL'

  // Calculate total items across all categories
  const totalItems = Object.values(macroCounts).reduce(
    (sum, cat) => sum + ((cat as { item_count?: number })?.item_count || 0),
    0
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-slate-500 mr-1">Filter by:</span>

      {/* Category pills */}
      {MACRO_CATEGORIES.map((cat) => {
        const count = (macroCounts[cat.key] as { item_count?: number })?.item_count || 0
        const isSelected = selectedCategory === cat.key
        const Icon = cat.icon

        // Skip categories with no items
        if (count === 0) return null

        return (
          <button
            key={cat.key}
            onClick={() => onCategoryChange(isSelected ? null : cat.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
              isSelected
                ? `${cat.color} ring-2 ring-offset-1 ring-navy-400`
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Icon size={14} />
            <span>{cat.label}</span>
            <span className={`text-xs ${isSelected ? 'opacity-80' : 'text-slate-400'}`}>
              ({count})
            </span>
          </button>
        )
      })}

      {/* All Items pill */}
      <button
        onClick={() => onCategoryChange('ALL')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
          isAllSelected
            ? 'bg-navy-100 text-navy-700 border-navy-200 ring-2 ring-offset-1 ring-navy-400'
            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
        }`}
      >
        <LayoutGrid size={14} />
        <span>All Items</span>
        <span className={`text-xs ${isAllSelected ? 'opacity-80' : 'text-slate-400'}`}>
          ({totalItems})
        </span>
        {isAllSelected && (
          <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-200 text-amber-800 rounded">
            LOG
          </span>
        )}
      </button>
    </div>
  )
}
