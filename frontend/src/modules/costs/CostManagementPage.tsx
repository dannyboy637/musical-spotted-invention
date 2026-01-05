import { useState } from 'react'
import { AlertTriangle, AlertCircle, RefreshCw, Database } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { useMenuEngineering } from '../../hooks/useAnalytics'
import { CostInputTable } from './CostInputTable'
import { MarginAnalysis } from './MarginAnalysis'
import { TopMarginItems } from './TopMarginItems'
import { Spinner } from '../../components/ui/Spinner'

export function CostManagementPage() {
  const { profile } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const { data: menuData, isLoading, error, refetch } = useMenuEngineering()
  const [costOverrides, setCostOverrides] = useState<Record<string, number>>({})

  const currentTenant = profile?.role === 'operator' ? activeTenant : profile?.tenant

  const handleCostChange = (itemName: string, costCents: number) => {
    setCostOverrides((prev) => ({
      ...prev,
      [itemName]: costCents,
    }))
  }

  if (!currentTenant) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-navy-900">Cost Management</h1>
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

  // Check if user has permission (owner or operator only)
  const canManageCosts = profile?.role === 'owner' || profile?.role === 'operator'

  if (!canManageCosts) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-navy-900">Cost Management</h1>
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-600">
            Cost management is only available to owners and operators.
          </p>
        </div>
      </div>
    )
  }

  // Page-level loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Cost Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track costs and margins for {currentTenant.name}
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500 mt-3">Loading menu items...</p>
        </div>
      </div>
    )
  }

  // Page-level error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Cost Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track costs and margins for {currentTenant.name}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-red-200 p-8">
          <div className="flex flex-col items-center text-center">
            <AlertCircle size={48} strokeWidth={1.5} className="text-red-400 mb-3" />
            <h3 className="text-lg font-medium text-slate-800 mb-2">
              Unable to load menu data
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              {(error as Error)?.message || 'An error occurred while fetching menu items'}
            </p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-navy-600 hover:bg-navy-700 rounded-lg transition-colors"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Page-level empty state
  if (!menuData?.items?.length) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Cost Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track costs and margins for {currentTenant.name}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <div className="flex flex-col items-center text-center">
            <Database size={48} strokeWidth={1.5} className="text-slate-300 mb-3" />
            <h3 className="text-lg font-medium text-slate-800 mb-2">
              No menu items available
            </h3>
            <p className="text-sm text-slate-600 mb-4 max-w-md">
              Import transaction data and regenerate menu items to start managing costs and margins.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900">Cost Management</h1>
        <p className="text-sm text-slate-500 mt-1">
          Track costs and margins for {currentTenant.name}
        </p>
      </div>

      {/* Demo Mode Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-amber-800">Demo Mode</h3>
          <p className="text-sm text-amber-700 mt-1">
            Showing estimated costs (30-45% of price). Enter your actual costs below to see real
            margins. Changes are saved locally and will persist until you clear your browser data.
          </p>
        </div>
      </div>

      {/* Cost Input Table */}
      <CostInputTable onCostChange={handleCostChange} costOverrides={costOverrides} />

      {/* Analysis Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MarginAnalysis costOverrides={costOverrides} />
        <TopMarginItems costOverrides={costOverrides} />
      </div>
    </div>
  )
}
