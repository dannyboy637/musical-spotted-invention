import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { PageHeader } from '../../components/layout/PageHeader'
import { ExportPdfButton } from '../../components/ui/ExportPdfButton'
import { PeakTimesCard } from './PeakTimesCard'
import { SalesHeatmap } from './SalesHeatmap'
import { DaypartBreakdown } from './DaypartBreakdown'
import { DayOfWeekChart } from './DayOfWeekChart'
import { SameDayTrend } from './SameDayTrend'
import { YearOverYearChart } from './YearOverYearChart'

export function TimeIntelligencePage() {
  const { profile } = useAuthStore()
  const { activeTenant } = useTenantStore()

  const currentTenant = profile?.role === 'operator' ? activeTenant : profile?.tenant

  if (!currentTenant) {
    return (
      <div className="space-y-6">
        <PageHeader title="Time Intelligence" />
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
    <div id="time-intelligence-export" className="space-y-6">
      <PageHeader
        title="Time Intelligence"
        subtitle={`Analyze sales patterns by time for ${currentTenant.name}`}
        actions={<ExportPdfButton title="Time Intelligence" targetId="time-intelligence-export" />}
      />

      {/* Peak Times Summary */}
      <PeakTimesCard />

      {/* Sales Heatmap */}
      <SalesHeatmap />

      {/* Daypart and Day of Week Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DaypartBreakdown />
        <DayOfWeekChart />
      </div>

      {/* Same-Day Trending */}
      <SameDayTrend />

      {/* Year-over-Year Comparison */}
      <YearOverYearChart />
    </div>
  )
}
