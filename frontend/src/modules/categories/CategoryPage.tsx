import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { PageHeader } from '../../components/layout/PageHeader'
import { ExportPdfButton } from '../../components/ui/ExportPdfButton'
import type { CategoryData } from '../../hooks/useAnalytics'
import { MacroCategoryCards } from './MacroCategoryCards'
import { CategoryBreakdownChart } from './CategoryBreakdownChart'
import { CategoryTable } from './CategoryTable'
import { CategoryDetailSection } from './CategoryDetailSection'
import { CategoryComparisonView } from './CategoryComparisonView'
import { BranchComparisonView } from './BranchComparisonView'
import { ViewModeToggle } from './ViewModeToggle'

export type ViewMode = 'single' | 'compare' | 'branch'

export function CategoryPage() {
  const { profile } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const [selectedMacro, setSelectedMacro] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('single')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const currentTenant = profile?.role === 'operator' ? activeTenant : profile?.tenant

  // For single mode, use first selected category
  const selectedCategory = viewMode === 'single' ? selectedCategories[0] || null : null

  const handleCategoryClick = (category: CategoryData) => {
    if (viewMode === 'single') {
      // In single mode, clicking toggles selection
      setSelectedCategories((prev) =>
        prev[0] === category.category ? [] : [category.category]
      )
    } else {
      // In compare/branch modes, toggle in the list (max 4)
      setSelectedCategories((prev) => {
        if (prev.includes(category.category)) {
          return prev.filter((c) => c !== category.category)
        }
        if (prev.length >= 4) {
          return prev // Max 4 categories
        }
        return [...prev, category.category]
      })
    }
  }

  if (!currentTenant) {
    return (
      <div className="space-y-6">
        <PageHeader title="Categories" />
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

  return (
    <div id="categories-export" className="space-y-6">
      <PageHeader
        title="Categories"
        subtitle={`Analyze category performance for ${currentTenant.name}`}
        actions={<ExportPdfButton title="Categories" targetId="categories-export" />}
      />

      {/* Macro Category Cards */}
      <MacroCategoryCards
        selectedMacro={selectedMacro}
        onMacroClick={setSelectedMacro}
      />

      {/* Charts and Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryBreakdownChart selectedMacro={selectedMacro} />
        <CategoryTable
          selectedMacro={selectedMacro}
          onCategoryClick={handleCategoryClick}
          selectedCategories={selectedCategories}
          viewMode={viewMode}
        />
      </div>

      {/* View Mode Toggle */}
      <ViewModeToggle value={viewMode} onChange={setViewMode} />

      {/* Category Detail Section (inline, replaces slide-out panel) */}
      {viewMode === 'single' && <CategoryDetailSection selectedCategory={selectedCategory} />}
      {viewMode === 'compare' && (
        <CategoryComparisonView selectedCategories={selectedCategories} />
      )}
      {viewMode === 'branch' && (
        <BranchComparisonView selectedCategory={selectedCategories[0] || null} />
      )}
    </div>
  )
}
