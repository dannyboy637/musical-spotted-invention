import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { PageHeader } from '../../components/layout/PageHeader'
import type { MenuEngineeringItem } from '../../hooks/useAnalytics'
import { QuadrantSummary } from './QuadrantSummary'
import { QuadrantChart } from './QuadrantChart'
import { ItemsTable } from './ItemsTable'
import { ItemDetailPanel } from './ItemDetailPanel'
import { MacroCategoryFilter } from './MacroCategoryFilter'
import { AdvancedFilters, type AdvancedFilterValues } from './AdvancedFilters'

export function MenuEngineeringPage() {
  const { profile } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const [selectedQuadrant, setSelectedQuadrant] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<MenuEngineeringItem | null>(null)
  const [macroCategory, setMacroCategory] = useState<string | null>('FOOD')
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterValues>({
    minPrice: null,
    maxPrice: null,
    minQuantity: null,
  })

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
  const showAllItems = macroCategory === null || macroCategory === 'ALL'

  // Common filter props to pass to all child components
  const filterProps = {
    macroCategory,
    minPrice: advancedFilters.minPrice,
    maxPrice: advancedFilters.maxPrice,
    minQuantity: advancedFilters.minQuantity,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu Engineering"
        subtitle={`Analyze menu items by popularity and profitability for ${currentTenant.name}`}
      />

      {/* Macro Category Filter Pills */}
      <MacroCategoryFilter
        selectedCategory={macroCategory}
        onCategoryChange={setMacroCategory}
      />

      {/* Advanced Filters */}
      <AdvancedFilters
        values={advancedFilters}
        onChange={setAdvancedFilters}
      />

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
