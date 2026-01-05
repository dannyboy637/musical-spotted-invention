import { BarChart3 } from 'lucide-react'
import { useCategories } from '../../hooks/useAnalytics'
import { formatCurrency, chartColors } from '../../lib/chartConfig'

const macroOrder = ['FOOD', 'BEVERAGE', 'ALCOHOL', 'SWEETS', 'RETAIL', 'OTHER']

const macroColors: Record<string, string> = {
  FOOD: chartColors[0],
  BEVERAGE: chartColors[1],
  ALCOHOL: chartColors[2],
  SWEETS: chartColors[3],
  RETAIL: chartColors[4],
  OTHER: chartColors[5],
}

interface MacroCategoryCardsProps {
  selectedMacro: string | null
  onMacroClick: (macro: string | null) => void
}

export function MacroCategoryCards({ selectedMacro, onMacroClick }: MacroCategoryCardsProps) {
  const { data, isLoading } = useCategories()

  // Get macro totals and sort by defined order
  const macros = Object.entries(data?.macro_totals || {})
    .sort(([a], [b]) => macroOrder.indexOf(a) - macroOrder.indexOf(b))

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 animate-pulse">
            <div className="h-3 bg-slate-200 rounded w-16 mb-2" />
            <div className="h-6 bg-slate-200 rounded w-20" />
          </div>
        ))}
      </div>
    )
  }

  if (macros.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col items-center justify-center text-slate-500 py-4">
          <BarChart3 size={32} strokeWidth={1.5} className="mb-2 text-slate-300" />
          <p className="text-sm text-slate-600">No category data available</p>
          <p className="text-xs text-slate-400 mt-1">
            Import transaction data to see category breakdown
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {macros.map(([macro, totals]) => {
        const isSelected = selectedMacro === macro
        const color = macroColors[macro] || chartColors[0]

        return (
          <button
            key={macro}
            onClick={() => onMacroClick(isSelected ? null : macro)}
            className={`bg-white border-2 rounded-lg p-4 text-left transition-all ${
              isSelected
                ? 'border-navy-600 shadow-md'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs font-medium text-slate-500 uppercase">
                {macro}
              </span>
            </div>
            <p className="text-lg font-semibold text-navy-900">
              {formatCurrency(totals.revenue)}
            </p>
            <p className="text-xs text-slate-400">
              {totals.item_count} items
            </p>
          </button>
        )
      })}
    </div>
  )
}
