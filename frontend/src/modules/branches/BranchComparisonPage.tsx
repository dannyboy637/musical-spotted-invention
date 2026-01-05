import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { PageHeader } from '../../components/layout/PageHeader'
import { usePerformanceBranches } from '../../hooks/useAnalytics'
import { BranchRevenueChart } from './BranchRevenueChart'
import { BranchMetricsTable } from './BranchMetricsTable'
import { TopItemsByBranch } from './TopItemsByBranch'
import { StatCard } from '../../components/ui/StatCard'

export function BranchComparisonPage() {
  const { profile } = useAuthStore()
  const { activeTenant } = useTenantStore()
  const { data, isLoading } = usePerformanceBranches()

  const currentTenant = profile?.role === 'operator' ? activeTenant : profile?.tenant

  if (!currentTenant) {
    return (
      <div className="space-y-6">
        <PageHeader title="Branch Comparison" />
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

  // Check if tenant has multiple branches
  const hasBranches = data?.branches && data.branches.length > 1

  if (!isLoading && !hasBranches) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Branch Comparison"
          subtitle={`Compare performance across locations for ${currentTenant.name}`}
        />
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
          <p className="text-slate-600">
            This tenant has only one branch. Branch comparison requires multiple locations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch Comparison"
        subtitle={`Compare performance across locations for ${currentTenant.name}`}
      />

      {/* Comparison Highlights */}
      {data?.comparison_metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Highest Revenue"
            value={data.comparison_metrics.highest_revenue || '-'}
            color="success"
            loading={isLoading}
          />
          <StatCard
            label="Lowest Revenue"
            value={data.comparison_metrics.lowest_revenue || '-'}
            color="warning"
            loading={isLoading}
          />
          <StatCard
            label="Highest Avg Ticket"
            value={data.comparison_metrics.highest_avg_ticket || '-'}
            color="info"
            loading={isLoading}
          />
          <StatCard
            label="Branch Count"
            value={data.branches?.length.toString() || '-'}
            loading={isLoading}
          />
        </div>
      )}

      {/* Revenue Chart */}
      <BranchRevenueChart />

      {/* Metrics Table */}
      <BranchMetricsTable />

      {/* Top Items by Branch */}
      <TopItemsByBranch />
    </div>
  )
}
