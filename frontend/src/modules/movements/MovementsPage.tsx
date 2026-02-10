import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { PageHeader } from '../../components/layout/PageHeader'
import { ExportPdfButton } from '../../components/ui/ExportPdfButton'
import { QuadrantSummaryCard } from './QuadrantSummaryCard'
import { YoYComparisonChart } from './YoYComparisonChart'
import { SeasonalTrendsChart } from './SeasonalTrendsChart'
import { ItemHistoryPanel } from './ItemHistoryPanel'

export function MovementsPage() {
  const { profile } = useAuthStore()
  const { activeTenant } = useTenantStore()

  const currentTenant = profile?.role === 'operator' ? activeTenant : profile?.tenant

  if (!currentTenant) {
    return (
      <div className="space-y-6">
        <PageHeader title="Movements" />
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
    <div id="movements-export" className="space-y-6">
      <PageHeader
        title="Movements"
        subtitle={`Historical performance trends and menu item movements for ${currentTenant.name}`}
        actions={<ExportPdfButton title="Movements" targetId="movements-export" />}
      />

      {/* Quadrant Distribution Summary */}
      <QuadrantSummaryCard />

      {/* Year-over-Year Comparison */}
      <YoYComparisonChart />

      {/* Seasonal Trends */}
      <SeasonalTrendsChart />

      {/* Item Performance History */}
      <ItemHistoryPanel />
    </div>
  )
}
