import { useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { PageHeader } from '../../components/layout/PageHeader'
import type { CategoryData } from '../../hooks/useAnalytics'
import { MacroCategoryCards } from './MacroCategoryCards'
import { CategoryBreakdownChart } from './CategoryBreakdownChart'
import { CategoryTable } from './CategoryTable'
import { CategoryItemsPanel } from './CategoryItemsPanel'

export function CategoryPage() {
  const { profile } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const [selectedMacro, setSelectedMacro] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const currentTenant = profile?.role === 'operator' ? activeTenant : profile?.tenant

  const handleCategoryClick = (category: CategoryData) => {
    setSelectedCategory(category.category)
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
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        subtitle={`Analyze category performance for ${currentTenant.name}`}
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
        />
      </div>

      {/* Category Items Panel */}
      <CategoryItemsPanel
        category={selectedCategory}
        onClose={() => setSelectedCategory(null)}
      />
    </div>
  )
}
