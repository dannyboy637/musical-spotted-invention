import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { PageHeader } from '../../components/layout/PageHeader'
import { ExportPdfButton } from '../../components/ui/ExportPdfButton'
import { PerformanceSummary } from './PerformanceSummary'
import { TrendCharts } from './TrendCharts'
import { GrowthMetrics } from './GrowthMetrics'
import { WeeklyRhythm } from './WeeklyRhythm'
import { DailyBreakdownTable } from '../../components/analytics/DailyBreakdownTable'

export function PerformancePage() {
  const { profile } = useAuthStore()
  const { activeTenant } = useTenantStore()

  const currentTenant = profile?.role === 'operator' ? activeTenant : profile?.tenant

  if (!currentTenant) {
    return (
      <div className="space-y-6">
        <PageHeader title="Performance" />
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
    <div id="performance-export" className="space-y-6">
      <PageHeader
        title="Performance"
        subtitle={`Track sales trends and growth for ${currentTenant.name}`}
        actions={<ExportPdfButton title="Performance" targetId="performance-export" />}
      />

      {/* Performance Summary */}
      <PerformanceSummary />

      {/* Growth Metrics */}
      <GrowthMetrics />

      {/* Weekly Rhythm */}
      <WeeklyRhythm />

      {/* Daily Breakdown Table */}
      <DailyBreakdownTable />

      {/* Trend Charts */}
      <TrendCharts />
    </div>
  )
}
