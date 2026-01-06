import { Building2, UserCog } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { PageHeader } from '../../components/layout/PageHeader'
import { AlertBanner } from '../../components/alerts/AlertBanner'
import { EmptyState } from '../../components/ui/EmptyState'
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
        <div className="bg-white rounded-lg border border-slate-200">
          {profile?.role === 'operator' ? (
            <EmptyState
              icon={Building2}
              title="Select a Restaurant"
              description="Choose a tenant from the header dropdown to view their analytics dashboard."
            />
          ) : (
            <EmptyState
              icon={UserCog}
              title="No Restaurant Assigned"
              description="Contact your administrator to be assigned to a restaurant."
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={`Overview for ${currentTenant.name}`} />

      {/* Alert Banner */}
      <AlertBanner />

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
