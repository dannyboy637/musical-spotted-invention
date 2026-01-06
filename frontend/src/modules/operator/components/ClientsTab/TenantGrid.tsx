import { useNavigate } from 'react-router-dom'
import {
  getHealthStatusColor,
  formatDataFreshness,
  formatCurrency,
} from '../../../../hooks/useOperator'
import type { TenantHealth } from '../../../../hooks/useOperator'
import { useTenantStore } from '../../../../stores/tenantStore'
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  Users,
  ShoppingCart,
  DollarSign,
  ExternalLink,
} from 'lucide-react'

interface TenantGridProps {
  tenants: TenantHealth[]
}

export function TenantGrid({ tenants }: TenantGridProps) {
  if (tenants.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <Users className="mx-auto h-12 w-12 text-slate-400" />
        <h3 className="mt-2 text-sm font-medium text-slate-900">No clients yet</h3>
        <p className="mt-1 text-sm text-slate-500">
          Add your first client in the Tools tab.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {tenants.map((tenant) => (
        <TenantCard key={tenant.tenant_id} tenant={tenant} />
      ))}
    </div>
  )
}

function TenantCard({ tenant }: { tenant: TenantHealth }) {
  const navigate = useNavigate()
  const { setActiveTenant } = useTenantStore()
  const healthColors = getHealthStatusColor(tenant.health_status)

  const handleViewDashboard = () => {
    // Set this tenant as active and navigate to dashboard
    setActiveTenant({
      id: tenant.tenant_id,
      name: tenant.tenant_name,
      slug: tenant.tenant_slug,
    })
    navigate('/')
  }

  const trendIsPositive = tenant.revenue_trend_pct >= 0

  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 overflow-hidden ${
        !tenant.is_active ? 'opacity-60' : ''
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Health indicator */}
          <div className={`w-3 h-3 rounded-full ${healthColors.dot}`} />
          <div>
            <h3 className="font-semibold text-navy-900">{tenant.tenant_name}</h3>
            {!tenant.is_active && (
              <span className="text-xs text-slate-500">Inactive</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Alert badge */}
          {tenant.alert_count > 0 && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                tenant.critical_alert_count > 0
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <AlertCircle size={12} />
              {tenant.alert_count}
            </span>
          )}
          {/* View button */}
          <button
            onClick={handleViewDashboard}
            className="p-1.5 text-slate-400 hover:text-navy-600 hover:bg-slate-100 rounded transition-colors"
            title="View Dashboard"
          >
            <ExternalLink size={16} />
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="p-4 space-y-3">
        {/* Revenue + Trend */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600">
            <DollarSign size={16} />
            <span className="text-sm">
              {tenant.data_period === 'all_time' ? 'All Time' : 'This Week'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-navy-900">
              {formatCurrency(tenant.revenue_this_week)}
            </span>
            {tenant.data_period !== 'all_time' && tenant.revenue_trend_pct !== 0 && (
              <span
                className={`inline-flex items-center text-xs font-medium ${
                  trendIsPositive ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {trendIsPositive ? (
                  <TrendingUp size={14} />
                ) : (
                  <TrendingDown size={14} />
                )}
                {trendIsPositive ? '+' : ''}
                {tenant.revenue_trend_pct.toFixed(1)}%
              </span>
            )}
          </div>
        </div>

        {/* Transaction count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600">
            <ShoppingCart size={16} />
            <span className="text-sm">Transactions</span>
          </div>
          <span className="font-medium text-navy-900">
            {tenant.transaction_count.toLocaleString()}
          </span>
        </div>

        {/* Avg Check */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600">
            <DollarSign size={16} />
            <span className="text-sm">Avg Check</span>
          </div>
          <span className="font-medium text-navy-900">
            {formatCurrency(tenant.avg_check)}
          </span>
        </div>

        {/* Data Freshness */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600">
            <Clock size={16} />
            <span className="text-sm">Last Sync</span>
          </div>
          <span
            className={`text-sm font-medium ${
              tenant.days_since_import === null
                ? 'text-red-600'
                : tenant.days_since_import > 7
                ? 'text-amber-600'
                : 'text-emerald-600'
            }`}
          >
            {formatDataFreshness(tenant.days_since_import)}
          </span>
        </div>

        {/* Users count */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-600">
            <Users size={16} />
            <span className="text-sm">Users</span>
          </div>
          <span className="font-medium text-navy-900">{tenant.user_count}</span>
        </div>
      </div>
    </div>
  )
}
