import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { PageHeader } from '../../components/layout/PageHeader'
import { KPISection } from './KPISection'
import { RevenueTrendChart } from './RevenueTrendChart'
import { TopItemsTable } from './TopItemsTable'
import { BottomItemsTable } from './BottomItemsTable'

export function DashboardPage() {
  const { profile } = useAuthStore()
  const { activeTenant } = useTenantStore()

  // For operators, show active tenant; for others, show their assigned tenant
  const currentTenant = profile?.role === 'operator' ? activeTenant : profile?.tenant

  if (!currentTenant) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
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
      <PageHeader title="Dashboard" subtitle={`Overview for ${currentTenant.name}`} />

      {/* KPI Cards */}
      <KPISection />

      {/* Revenue Trend Chart */}
      <RevenueTrendChart />

      {/* Top and Bottom Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopItemsTable />
        <BottomItemsTable />
      </div>
    </div>
  )
}
