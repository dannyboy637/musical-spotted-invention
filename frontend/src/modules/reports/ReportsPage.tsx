import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText,
  Plus,
  RefreshCw,
  Filter,
  CheckCircle,
  Clock,
  Send,
  Eye,
  Trash2,
  ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { useTenantStore } from '../../stores/tenantStore'
import { PageHeader } from '../../components/layout/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import {
  useReports,
  useGenerateReport,
  useGenerateAllReports,
  useDeleteReport,
  getStatusColor,
  getPeriodTypeLabel,
  getPeriodTypeColor,
  formatDateRange,
  formatCurrency,
  type Report,
  type ReportStatus,
  type NarrativeStyle,
  type PeriodType,
} from '../../hooks/useReports'

function StatusBadge({ status }: { status: ReportStatus }) {
  const colors = getStatusColor(status)
  const icons = {
    pending: <Clock className="h-3 w-3" />,
    approved: <CheckCircle className="h-3 w-3" />,
    sent: <Send className="h-3 w-3" />,
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function PeriodTypeBadge({ periodType }: { periodType: PeriodType }) {
  const colors = getPeriodTypeColor(periodType)
  const label = getPeriodTypeLabel(periodType)

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      {label}
    </span>
  )
}

interface ReportRowProps {
  report: Report
  onDelete: (id: string) => void
  isDeleting: boolean
  canDelete: boolean
}

function ReportRow({ report, onDelete, isDeleting, canDelete }: ReportRowProps) {
  const kpis = report.report_data?.kpis || {}

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:border-navy-300 dark:hover:border-navy-600 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-medium text-navy-900 dark:text-white truncate">
              {report.tenant_name || 'Unknown Tenant'}
            </h3>
            <PeriodTypeBadge periodType={report.period_type || 'week'} />
            <StatusBadge status={report.status as ReportStatus} />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            {formatDateRange(report.period_start, report.period_end)}
          </p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Revenue</span>
              <p className="font-medium text-navy-900 dark:text-white">
                {formatCurrency(kpis.revenue || 0)}
                {kpis.revenue_change_pct != null && (
                  <span className={`ml-1 text-xs ${kpis.revenue_change_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {kpis.revenue_change_pct >= 0 ? '+' : ''}{kpis.revenue_change_pct.toFixed(1)}%
                  </span>
                )}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Transactions</span>
              <p className="font-medium text-navy-900 dark:text-white">
                {(kpis.transactions || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Avg Check</span>
              <p className="font-medium text-navy-900 dark:text-white">
                {formatCurrency(kpis.avg_check || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/reports/${report.id}`}
            className="p-2 text-slate-500 hover:text-navy-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            title="View report"
          >
            <Eye className="h-5 w-5" />
          </Link>
          {canDelete && report.status !== 'sent' && (
            <button
              onClick={() => onDelete(report.id)}
              disabled={isDeleting}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50"
              title="Delete report"
            >
              {isDeleting ? <Spinner size="sm" /> : <Trash2 className="h-5 w-5" />}
            </button>
          )}
          <Link
            to={`/reports/${report.id}`}
            className="p-2 text-slate-400 hover:text-navy-600 rounded-md transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
      {report.sent_at && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
          Sent to {report.recipient_email} on {new Date(report.sent_at).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}

interface GenerateModalProps {
  isOpen: boolean
  onClose: () => void
  tenants: Array<{ id: string; name: string }>
  onGenerate: (tenantId: string, periodType: PeriodType, style: NarrativeStyle) => void
  isGenerating: boolean
}

function GenerateModal({ isOpen, onClose, tenants, onGenerate, isGenerating }: GenerateModalProps) {
  const [selectedTenant, setSelectedTenant] = useState('')
  const [periodType, setPeriodType] = useState<PeriodType>('week')
  const [narrativeStyle, setNarrativeStyle] = useState<NarrativeStyle>('full')

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">
          Generate Report
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tenant
            </label>
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              <option value="">Select a tenant...</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Time Period
            </label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            >
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="quarter">Last Quarter</option>
              <option value="year">Last Year</option>
            </select>
            {periodType !== 'week' && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Historical reports do not include alerts
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Narrative Style
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="style"
                  value="full"
                  checked={narrativeStyle === 'full'}
                  onChange={() => setNarrativeStyle('full')}
                  className="text-navy-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Full Summary</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="style"
                  value="bullets"
                  checked={narrativeStyle === 'bullets'}
                  onChange={() => setNarrativeStyle('bullets')}
                  className="text-navy-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Bullet Points</span>
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onGenerate(selectedTenant, periodType, narrativeStyle)}
            disabled={!selectedTenant || isGenerating}
            className="px-4 py-2 text-sm font-medium text-white bg-navy-600 hover:bg-navy-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isGenerating && <Spinner size="sm" />}
            Generate
          </button>
        </div>
      </div>
    </div>
  )
}

export function ReportsPage() {
  const { profile } = useAuthStore()
  const { tenants } = useTenantStore()
  const [statusFilter, setStatusFilter] = useState<ReportStatus | ''>('')
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data, isLoading, refetch } = useReports({
    status: statusFilter || undefined,
  })
  const generateMutation = useGenerateReport()
  const generateAllMutation = useGenerateAllReports()
  const deleteMutation = useDeleteReport()

  // Only operators and owners can access reports
  if (profile?.role !== 'operator' && profile?.role !== 'owner') {
    return (
      <div className="space-y-6">
        <PageHeader title="Report Center" />
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Only operators and owners can access the Report Center.
          </p>
        </div>
      </div>
    )
  }

  const isOperator = profile?.role === 'operator'

  const handleGenerate = async (tenantId: string, periodType: PeriodType, style: NarrativeStyle) => {
    try {
      await generateMutation.mutateAsync({
        tenant_id: tenantId,
        period_type: periodType,
        narrative_style: style,
      })
      setShowGenerateModal(false)
    } catch {
      // Error handled by mutation
    }
  }

  const handleGenerateAll = async () => {
    if (confirm('Generate reports for all tenants? This will create pending reports for the previous week.')) {
      try {
        const result = await generateAllMutation.mutateAsync({ narrative_style: 'full' })
        alert(`Generated ${result.generated} reports. ${result.skipped} tenants already had reports.`)
      } catch {
        // Error handled by mutation
      }
    }
  }

  const handleDelete = async (reportId: string) => {
    if (confirm('Delete this report? This cannot be undone.')) {
      setDeletingId(reportId)
      try {
        await deleteMutation.mutateAsync(reportId)
      } finally {
        setDeletingId(null)
      }
    }
  }

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'sent', label: 'Sent' },
  ]

  // Summary counts
  const pendingCount = data?.reports.filter(r => r.status === 'pending').length || 0
  const approvedCount = data?.reports.filter(r => r.status === 'approved').length || 0
  const sentCount = data?.reports.filter(r => r.status === 'sent').length || 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Report Center"
        subtitle="Generate, review, and send weekly reports to clients"
      />

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ReportStatus | '')}
              className="text-sm border border-slate-200 dark:border-slate-600 rounded-md px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={() => refetch()}
            className="p-2 text-slate-500 hover:text-navy-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Generate All - operator only (multi-tenant) */}
          {isOperator && (
            <button
              onClick={handleGenerateAll}
              disabled={generateAllMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {generateAllMutation.isPending ? (
                <Spinner size="sm" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Generate All
            </button>
          )}

          {/* Generate Single (operator only) */}
          {isOperator && (
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-navy-600 hover:bg-navy-700 rounded-lg transition-colors"
            >
              <Plus className="h-4 w-4" />
              Generate Report
            </button>
          )}
        </div>
      </div>

      {!isOperator && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          Reports are read-only for owners. Ask an operator to generate, approve, send, or delete reports.
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Pending</p>
              <p className="text-xl font-semibold text-navy-900 dark:text-white">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Approved</p>
              <p className="text-xl font-semibold text-navy-900 dark:text-white">{approvedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Send className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Sent</p>
              <p className="text-xl font-semibold text-navy-900 dark:text-white">{sentCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner size="lg" />
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">Loading reports...</p>
        </div>
      ) : !data?.reports?.length ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <FileText className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-400 mb-2">No reports yet</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            Click "Generate Report" or "Generate All" to create weekly reports.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.reports.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              onDelete={handleDelete}
              isDeleting={deletingId === report.id}
              canDelete={isOperator}
            />
          ))}
        </div>
      )}

      {/* Generate Modal */}
      {isOperator && (
        <GenerateModal
          isOpen={showGenerateModal}
          onClose={() => setShowGenerateModal(false)}
          tenants={tenants || []}
          onGenerate={handleGenerate}
          isGenerating={generateMutation.isPending}
        />
      )}
    </div>
  )
}
