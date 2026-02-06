import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { PageHeader } from '../../components/layout/PageHeader'
import { ExportPdfButton } from '../../components/ui/ExportPdfButton'
import type { MenuEngineeringItem } from '../../hooks/useAnalytics'
import { QuadrantSummary } from './QuadrantSummary'
import { QuadrantChart } from './QuadrantChart'
import { ItemsTable } from './ItemsTable'
import { ItemDetailPanel } from './ItemDetailPanel'
import { MacroCategoryFilter } from './MacroCategoryFilter'
import { AdvancedFilters } from './AdvancedFilters'
import { useMenuEngineeringFilters } from './useMenuEngineeringFilters'

export function MenuEngineeringPage() {
  const { profile } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuEngineeringItem | null>(null)

  // Use the new filter hook with URL persistence
  const {
    applied,
    draft,
    updateDraft,
    applyFilters,
    clearFilters,
    hasUnappliedChanges,
  } = useMenuEngineeringFilters()

  const currentTenant = profile?.role === 'operator' ? activeTenant : profile?.tenant

  if (!currentTenant) {
    return (
      <div className="space-y-6">
        <PageHeader title="Menu Engineering" />
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-600">
            {profile?.role === 'operator'
              ? 'Select a tenant from the header to view their data.'
              : 'No tenant assigned. Contact your administrator.'}
          </p>
        </div>
      </div>
    )
  }

  // Determine if we're showing all items (logarithmic scale) or filtered (linear scale)
  // Use APPLIED filters for the actual data display
  const showAllItems = applied.macroCategory === null || applied.macroCategory === 'ALL'

  // Common filter props to pass to all child components (use APPLIED values)
  const filterProps = {
    macroCategory: applied.macroCategory,
    minPrice: applied.minPrice,
    maxPrice: applied.maxPrice,
    minQuantity: applied.minQuantity,
  }

  return (
    <div id="menu-engineering-export" className="space-y-6">
      <PageHeader
        title="Menu Engineering"
        subtitle={`Analyze menu items by popularity and profitability for ${currentTenant.name}`}
        actions={<ExportPdfButton title="Menu Engineering" targetId="menu-engineering-export" />}
      />

      {/* Filter Controls Section */}
      <div className="space-y-3">
        {/* Macro Category Filter Pills - uses draft values */}
        <MacroCategoryFilter
          selectedCategory={draft.macroCategory}
          onCategoryChange={(category) => updateDraft({ macroCategory: category })}
        />

        {/* Advanced Filters - uses draft values */}
        <AdvancedFilters
          values={{
            minPrice: draft.minPrice,
            maxPrice: draft.maxPrice,
            minQuantity: draft.minQuantity,
          }}
          onChange={(values) =>
            updateDraft({
              minPrice: values.minPrice,
              maxPrice: values.maxPrice,
              minQuantity: values.minQuantity,
            })
          }
          showApplyButton={false}
        />

        {/* Apply/Clear Filters Bar */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {hasUnappliedChanges ? (
              <span className="text-amber-600 font-medium">
                You have unapplied filter changes
              </span>
            ) : (
              'Filters are up to date'
            )}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
            >
              <X size={14} />
              Clear Filters
            </button>
            <button
              onClick={applyFilters}
              disabled={!hasUnappliedChanges}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                hasUnappliedChanges
                  ? 'bg-navy-600 text-white hover:bg-navy-700'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check size={14} />
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Quadrant Summary Cards */}
      <QuadrantSummary
        selectedQuadrant={selectedQuadrant}
        onQuadrantClick={setSelectedQuadrant}
        {...filterProps}
      />

      {/* Scatter Plot */}
      <QuadrantChart
        selectedQuadrant={selectedQuadrant}
        onItemClick={setSelectedItem}
        useLogScale={showAllItems}
        {...filterProps}
      />

      {/* Items Table */}
      <ItemsTable
        selectedQuadrant={selectedQuadrant}
        onItemClick={setSelectedItem}
        {...filterProps}
      />

      {/* Item Detail Panel */}
      <ItemDetailPanel
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  )
}
