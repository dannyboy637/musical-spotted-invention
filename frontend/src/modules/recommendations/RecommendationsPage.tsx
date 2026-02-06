import { useState, useMemo } from 'react'
import { Settings, TrendingUp, Scissors, Package, AlertCircle, RefreshCw } from 'lucide-react'
import { ExportPdfButton } from '../../components/ui/ExportPdfButton'
import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { useFilterStore } from '../../stores/filterStore'
import { useRecommendationMenuEngineering, useRecommendationBundles } from '../../hooks/useAnalytics'
import { RecommendationCard } from './RecommendationCard'
import { RuleSettings } from './RuleSettings'
import { RecommendationsFilters, getDateRangeForPeriod } from './RecommendationsFilters'
import type { PeriodOption } from './RecommendationsFilters'
import { loadRuleConfig, saveRuleConfig, generateRecommendations } from './ruleEngine'
import type { RuleConfig } from './ruleEngine'
import { Spinner } from '../../components/ui/Spinner'

export function RecommendationsPage() {
  const { profile } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const { availableBranches } = useFilterStore()

  // Local filter state (bypasses global filters)
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodOption>('quarter')
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)

  // Calculate date range from selected period
  const { startDate, endDate } = useMemo(
    () => getDateRangeForPeriod(selectedPeriod),
    [selectedPeriod]
  )

  // Use recommendations-specific hooks with explicit dates
  const { data: menuData, isLoading: menuLoading, error: menuError, refetch: refetchMenu } = useRecommendationMenuEngineering({
    startDate,
    endDate,
    branch: selectedBranch,
  })
  const { data: bundleData, isLoading: bundleLoading, error: bundleError, refetch: refetchBundles } = useRecommendationBundles({
    startDate,
    endDate,
    branch: selectedBranch,
    minFrequency: 3,
  })

  const [config, setConfig] = useState<RuleConfig>(loadRuleConfig)
  const [showSettings, setShowSettings] = useState(false)

  const currentTenant = profile?.role === 'operator' ? activeTenant : profile?.tenant

  const isLoading = menuLoading || bundleLoading
  const hasError = menuError || bundleError
  const errorMessage = menuError
    ? `Menu data: ${(menuError as Error)?.message || 'Failed to load'}`
    : bundleError
      ? `Bundle data: ${(bundleError as Error)?.message || 'Failed to load'}`
      : null

  // Generate recommendations
  const recommendations = useMemo(() => {
    if (!menuData?.items?.length) return []

    const medianRevenue =
      menuData.items.reduce((sum, item) => sum + item.total_revenue, 0) /
      menuData.items.length

    return generateRecommendations(
      menuData.items,
      bundleData?.pairs || [],
      menuData.median_quantity,
      medianRevenue,
      config
    )
  }, [menuData, bundleData, config])

  // Group recommendations by type
  const promoteRecs = recommendations.filter((r) => r.type === 'promote')
  const cutRecs = recommendations.filter((r) => r.type === 'cut')
  const bundleRecs = recommendations.filter((r) => r.type === 'bundle')

  const handleSaveConfig = (newConfig: RuleConfig) => {
    setConfig(newConfig)
    saveRuleConfig(newConfig)
  }

  if (!currentTenant) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-navy-900">Recommendations</h1>
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
    <div id="recommendations-export" className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">Recommendations</h1>
          <p className="text-sm text-slate-500 mt-1">
            Strategic insights for menu optimization - {currentTenant.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPdfButton title="Recommendations" targetId="recommendations-export" />
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Rule Settings
          </button>
        </div>
      </div>

      {/* Period and Branch Filters */}
      <RecommendationsFilters
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        selectedBranch={selectedBranch}
        onBranchChange={setSelectedBranch}
        availableBranches={availableBranches}
      />

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500 mt-3">Analyzing menu data and purchase patterns...</p>
        </div>
      ) : hasError ? (
        <div className="bg-white rounded-lg border border-red-200 p-8">
          <div className="flex flex-col items-center text-center">
            <AlertCircle size={48} strokeWidth={1.5} className="text-red-400 mb-3" />
            <h3 className="text-lg font-medium text-slate-800 mb-2">
              Unable to generate recommendations
            </h3>
            <p className="text-sm text-slate-600 mb-4">{errorMessage}</p>
            <button
              onClick={() => {
                refetchMenu()
                refetchBundles()
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-navy-600 hover:bg-navy-700 rounded-lg transition-colors"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-600 mb-2">No recommendations available</p>
          <p className="text-sm text-slate-400">
            {!menuData?.items?.length
              ? 'Import transaction data to generate recommendations'
              : 'Try adjusting the date range or filters'}
          </p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">To Promote</span>
              </div>
              <p className="text-2xl font-semibold text-emerald-800 mt-1">
                {promoteRecs.length}
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">To Review</span>
              </div>
              <p className="text-2xl font-semibold text-amber-800 mt-1">
                {cutRecs.length}
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-700">Bundle Ideas</span>
              </div>
              <p className="text-2xl font-semibold text-blue-800 mt-1">
                {bundleRecs.length}
              </p>
            </div>
          </div>

          {/* Promote Section */}
          {promoteRecs.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-navy-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                Items to Promote
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {promoteRecs.map((rec) => (
                  <RecommendationCard key={rec.id} recommendation={rec} />
                ))}
              </div>
            </div>
          )}

          {/* Cut Section */}
          {cutRecs.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-navy-900 mb-4 flex items-center gap-2">
                <Scissors className="w-5 h-5 text-amber-600" />
                Items to Review
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cutRecs.map((rec) => (
                  <RecommendationCard key={rec.id} recommendation={rec} />
                ))}
              </div>
            </div>
          )}

          {/* Bundle Section */}
          {bundleRecs.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-navy-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Bundle Opportunities
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bundleRecs.map((rec) => (
                  <RecommendationCard key={rec.id} recommendation={rec} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <RuleSettings
          config={config}
          onSave={handleSaveConfig}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
