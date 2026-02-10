import { useState } from 'react'
import { ChevronDown, ChevronUp, X } from 'lucide-react'
import { formatCurrency } from '../../lib/chartConfig'

export interface AdvancedFilterValues {
  minPrice: number | null
  maxPrice: number | null
  minQuantity: number | null
}

interface AdvancedFiltersProps {
  values: AdvancedFilterValues
  onChange: (values: AdvancedFilterValues) => void
  /** When false, hides internal Apply/Clear buttons. Parent handles apply logic. */
  showApplyButton?: boolean
}

export function AdvancedFilters({ values, onChange, showApplyButton = true }: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Local state for inputs (before applying)
  const [localMinPrice, setLocalMinPrice] = useState<string>(
    values.minPrice != null ? String(values.minPrice / 100) : ''
  )
  const [localMaxPrice, setLocalMaxPrice] = useState<string>(
    values.maxPrice != null ? String(values.maxPrice / 100) : ''
  )
  const [localMinQty, setLocalMinQty] = useState<string>(
    values.minQuantity != null ? String(values.minQuantity) : ''
  )

  // Sync local state when values change from parent (e.g., on clear)
  // This is a controlled-reset pattern: parent clears applied filters, we reset local inputs
  const [prevValues, setPrevValues] = useState(values)
  if (
    prevValues.minPrice !== values.minPrice ||
    prevValues.maxPrice !== values.maxPrice ||
    prevValues.minQuantity !== values.minQuantity
  ) {
    setPrevValues(values)
    setLocalMinPrice(values.minPrice != null ? String(values.minPrice / 100) : '')
    setLocalMaxPrice(values.maxPrice != null ? String(values.maxPrice / 100) : '')
    setLocalMinQty(values.minQuantity != null ? String(values.minQuantity) : '')
  }

  const hasActiveFilters =
    values.minPrice != null || values.maxPrice != null || values.minQuantity != null

  // Helper to parse and call onChange
  const notifyChange = (minP: string, maxP: string, minQ: string) => {
    onChange({
      minPrice: minP ? Math.round(parseFloat(minP) * 100) : null,
      maxPrice: maxP ? Math.round(parseFloat(maxP) * 100) : null,
      minQuantity: minQ ? parseInt(minQ, 10) : null,
    })
  }

  const handleMinPriceChange = (value: string) => {
    setLocalMinPrice(value)
    if (!showApplyButton) {
      notifyChange(value, localMaxPrice, localMinQty)
    }
  }

  const handleMaxPriceChange = (value: string) => {
    setLocalMaxPrice(value)
    if (!showApplyButton) {
      notifyChange(localMinPrice, value, localMinQty)
    }
  }

  const handleMinQtyChange = (value: string) => {
    setLocalMinQty(value)
    if (!showApplyButton) {
      notifyChange(localMinPrice, localMaxPrice, value)
    }
  }

  const handleApply = () => {
    notifyChange(localMinPrice, localMaxPrice, localMinQty)
  }

  const handleClear = () => {
    setLocalMinPrice('')
    setLocalMaxPrice('')
    setLocalMinQty('')
    onChange({
      minPrice: null,
      maxPrice: null,
      minQuantity: null,
    })
  }

  // Show active filter summary
  const filterSummary = () => {
    const parts: string[] = []
    if (values.minPrice != null || values.maxPrice != null) {
      const min = values.minPrice != null ? formatCurrency(values.minPrice) : '₱0'
      const max = values.maxPrice != null ? formatCurrency(values.maxPrice) : '∞'
      parts.push(`Price: ${min} - ${max}`)
    }
    if (values.minQuantity != null) {
      parts.push(`Min Qty: ${values.minQuantity}+`)
    }
    return parts.join(' • ')
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg">
      {/* Header / Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>Advanced Filters</span>
          {hasActiveFilters && (
            <span className="px-2 py-0.5 text-xs font-medium bg-navy-100 text-navy-700 rounded-full">
              {filterSummary()}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp size={18} className="text-slate-400" />
        ) : (
          <ChevronDown size={18} className="text-slate-400" />
        )}
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-end gap-4">
            {/* Price Range */}
            <div className="flex items-center gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Min Price
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    ₱
                  </span>
                  <input
                    type="number"
                    value={localMinPrice}
                    onChange={(e) => handleMinPriceChange(e.target.value)}
                    placeholder="0"
                    className="w-24 pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                  />
                </div>
              </div>
              <span className="text-slate-400 pb-1">to</span>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Max Price
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                    ₱
                  </span>
                  <input
                    type="number"
                    value={localMaxPrice}
                    onChange={(e) => handleMaxPriceChange(e.target.value)}
                    placeholder="∞"
                    className="w-24 pl-7 pr-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-8 w-px bg-slate-200 hidden sm:block" />

            {/* Min Quantity */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Min Qty Sold
              </label>
              <input
                type="number"
                value={localMinQty}
                onChange={(e) => handleMinQtyChange(e.target.value)}
                placeholder="0"
                className="w-20 px-2.5 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              />
            </div>

            {/* Actions - only show when showApplyButton is true */}
            {showApplyButton && (
              <div className="flex items-center gap-2 ml-auto">
                {hasActiveFilters && (
                  <button
                    onClick={handleClear}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <X size={14} />
                    Clear
                  </button>
                )}
                <button
                  onClick={handleApply}
                  className="px-4 py-1.5 text-sm font-medium text-white bg-navy-600 hover:bg-navy-700 rounded-md transition-colors"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
