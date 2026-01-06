import { TenantGrid } from './TenantGrid'
import { AggregatedAlerts } from './AggregatedAlerts'
import { TaskList } from './TaskList'
import { useOperatorDashboard } from '../../../../hooks/useOperator'
import { Spinner } from '../../../../components/ui/Spinner'
import { Users, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

export function ClientsTab() {
  const { data, isLoading, error } = useOperatorDashboard()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Failed to load dashboard data. Please try again.</p>
      </div>
    )
  }

  const summary = data?.summary

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={Users}
          label="Active Clients"
          value={summary?.active_tenants ?? 0}
          subtext={`of ${summary?.total_tenants ?? 0} total`}
          iconBg="bg-navy-100"
          iconColor="text-navy-600"
        />
        <SummaryCard
          icon={CheckCircle}
          label="Healthy"
          value={summary?.healthy_tenants ?? 0}
          subtext="no issues"
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Needs Attention"
          value={summary?.attention_needed ?? 0}
          subtext="requires action"
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
        <SummaryCard
          icon={Clock}
          label="Pending Tasks"
          value={summary?.pending_tasks ?? 0}
          subtext={summary?.overdue_tasks ? `${summary.overdue_tasks} overdue` : 'none overdue'}
          iconBg="bg-slate-100"
          iconColor="text-slate-600"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Tenant Cards - Takes 2 columns */}
        <div className="xl:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-navy-900">Client Overview</h2>
          <TenantGrid tenants={data?.tenants ?? []} />
        </div>

        {/* Sidebar - Alerts and Tasks */}
        <div className="space-y-6">
          <AggregatedAlerts />
          <TaskList />
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  subtext,
  iconBg,
  iconColor,
}: {
  icon: typeof Users
  label: string
  value: number
  subtext: string
  iconBg: string
  iconColor: string
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${iconBg}`}>
          <Icon size={20} className={iconColor} />
        </div>
        <div>
          <div className="text-2xl font-bold text-navy-900">{value}</div>
          <div className="text-sm text-slate-600">{label}</div>
          <div className="text-xs text-slate-500">{subtext}</div>
        </div>
      </div>
    </div>
  )
}
