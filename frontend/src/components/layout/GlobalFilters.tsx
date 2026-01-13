import { useEffect, useState } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { X, ChevronDown, ChevronUp, Filter, Info } from 'lucide-react'
import { DateRangePicker } from '../ui/DateRangePicker'
import { MultiSelect } from '../ui/MultiSelect'
import {
  useFilterStore,
  filtersToSearchParams,
  searchParamsToFilters,
} from '../../stores/filterStore'

export function GlobalFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [isExpanded, setIsExpanded] = useState(false)
  const location = useLocation()
  const {
    dateRange,
    branches,
    categories,
    availableBranches,
    availableCategories,
    setDateRange,
    setBranches,
    setCategories,
    clearFilters,
  } = useFilterStore()

  // Hide branch filter on menu engineering page (data is restaurant-wide)
  const isMenuEngineering = location.pathname === '/menu-engineering'
  const showBranchFilter = !isMenuEngineering

  const hasActiveFilters = dateRange !== null || branches.length > 0 || categories.length > 0
  const activeFilterCount = (dateRange ? 1 : 0) + (branches.length > 0 ? 1 : 0) + (categories.length > 0 ? 1 : 0)

  // Sync from URL on mount
  useEffect(() => {
    const urlFilters = searchParamsToFilters(searchParams)

    if (urlFilters.dateRange) {
      setDateRange(urlFilters.dateRange)
    }
    if (urlFilters.branches) {
      setBranches(urlFilters.branches)
    }
    if (urlFilters.categories) {
      setCategories(urlFilters.categories)
    }
  }, []) // Only on mount

  // Sync to URL when filters change
  useEffect(() => {
    const params = filtersToSearchParams({ dateRange, branches, categories } as any)

    // Only update if params actually changed
    const currentParams = searchParams.toString()
    const newParams = params.toString()

    if (currentParams !== newParams) {
      setSearchParams(params, { replace: true })
    }
  }, [dateRange, branches, categories])

  return (
    <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
      {/* Mobile: Collapsible header */}
      <div className="sm:hidden px-4 py-3">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-500" />
            <span className="font-medium text-slate-700">Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium bg-navy-100 text-navy-700 rounded-full">
                {activeFilterCount}
              </span>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp size={18} className="text-slate-400" />
          ) : (
            <ChevronDown size={18} className="text-slate-400" />
          )}
        </button>
      </div>

      {/* Filter controls - always visible on desktop, collapsible on mobile */}
      <div className={`px-4 lg:px-6 py-3 sm:block ${isExpanded ? 'block border-t border-slate-100' : 'hidden'}`}>
        <div className="flex flex-wrap items-end gap-4">
          {/* Date Range */}
          <div className="w-full sm:w-auto min-w-[280px]">
            <DateRangePicker value={dateRange} onChange={setDateRange} />
          </div>

          {/* Branches - hidden on menu engineering page */}
          {showBranchFilter ? (
            <div className="w-full sm:w-auto min-w-[180px]">
              <MultiSelect
                label="Branches"
                options={availableBranches}
                selected={branches}
                onChange={setBranches}
                placeholder="All branches"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-500 bg-slate-50 rounded-md border border-slate-200">
              <Info size={14} />
              <span>Restaurant-wide view (all branches)</span>
            </div>
          )}

          {/* Categories */}
          <div className="w-full sm:w-auto min-w-[180px]">
            <MultiSelect
              label="Categories"
              options={availableCategories}
              selected={categories}
              onChange={setCategories}
              placeholder="All categories"
            />
          </div>

          {/* Clear All Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors self-end"
            >
              <X size={14} />
              <span>Clear filters</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
