import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  Send,
  Edit3,
  Save,
  X,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Mail,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { PageHeader } from '../../components/layout/PageHeader'
import { Spinner } from '../../components/ui/Spinner'
import {
  useReport,
  useUpdateReport,
  useRegenerateNarrative,
  useApproveReport,
  useSendReport,
  getStatusColor,
  getPeriodTypeLabel,
  getPeriodTypeColor,
  formatDateRange,
  formatCurrency,
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

function KPICard({ label, value, change }: { label: string; value: string; change?: number }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-2xl font-semibold text-navy-900 dark:text-white mt-1">{value}</p>
      {change != null && (
        <p className={`text-sm mt-1 flex items-center gap-1 ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {change >= 0 ? '+' : ''}{change.toFixed(1)}% vs last period
        </p>
      )}
    </div>
  )
}

export function ReportPreviewPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuthStore()

  const { data: report, isLoading, error } = useReport(id)
  const updateMutation = useUpdateReport()
  const regenerateMutation = useRegenerateNarrative()
  const approveMutation = useApproveReport()
  const sendMutation = useSendReport()

  const [isEditing, setIsEditing] = useState(false)
  const [editedNarrative, setEditedNarrative] = useState('')
  const [narrativeStyle, setNarrativeStyle] = useState<NarrativeStyle>('full')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [showSendModal, setShowSendModal] = useState(false)

  // Sync local state with report data using "adjust state during render" pattern
  const [prevReportId, setPrevReportId] = useState<string | undefined>(undefined)
  if (report && report.id !== prevReportId) {
    setPrevReportId(report.id)
    setEditedNarrative(report.narrative_text || '')
    setNarrativeStyle(report.narrative_style as NarrativeStyle)
    setRecipientEmail(report.recipient_email || '')
  }

  // Only operators and owners can access
  if (profile?.role !== 'operator' && profile?.role !== 'owner') {
    return (
      <div className="space-y-6">
        <PageHeader title="Report Preview" />
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            Only operators and owners can access reports.
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">Loading report...</p>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="space-y-6">
        <PageHeader title="Report Preview" />
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 text-center">
          <p className="text-red-600 dark:text-red-400">Failed to load report.</p>
          <Link to="/reports" className="text-navy-600 hover:underline mt-2 inline-block">
            Back to Report Center
          </Link>
        </div>
      </div>
    )
  }

  const kpis = report.report_data?.kpis || {}
  const topItems = report.report_data?.top_items || []
  const gainers = report.report_data?.gainers || []
  const decliners = report.report_data?.decliners || []
  const alerts = report.report_data?.alerts || []

  const handleSaveNarrative = async () => {
    await updateMutation.mutateAsync({
      reportId: report.id,
      data: { narrative_text: editedNarrative },
    })
    setIsEditing(false)
  }

  const handleRegenerate = async () => {
    await regenerateMutation.mutateAsync({
      reportId: report.id,
      narrative_style: narrativeStyle,
    })
  }

  const handleApprove = async () => {
    await approveMutation.mutateAsync(report.id)
  }

  const handleSend = async () => {
    await sendMutation.mutateAsync({
      reportId: report.id,
      data: recipientEmail ? { recipient_email: recipientEmail } : undefined,
    })
    setShowSendModal(false)
  }

  const isOperator = profile?.role === 'operator'
  const isSent = report.status === 'sent'
  const isApproved = report.status === 'approved'
  const isPending = report.status === 'pending'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/reports"
            className="p-2 text-slate-500 hover:text-navy-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-navy-900 dark:text-white">
                {report.tenant_name || 'Report'}
              </h1>
              <PeriodTypeBadge periodType={report.period_type || 'week'} />
              <StatusBadge status={report.status as ReportStatus} />
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              {formatDateRange(report.period_start, report.period_end)}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {isOperator && !isSent && (
            <>
              {isPending && (
                <button
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {approveMutation.isPending ? <Spinner size="sm" /> : <CheckCircle className="h-4 w-4" />}
                  Approve
                </button>
              )}
              {isApproved && (
                <button
                  onClick={() => setShowSendModal(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                >
                  <Send className="h-4 w-4" />
                  Send Report
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Send Confirmation */}
      {report.sent_at && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg px-4 py-3 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Sent to {report.recipient_email} on {new Date(report.sent_at).toLocaleString()}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          label="Total Revenue"
          value={formatCurrency(kpis.revenue || 0)}
          change={kpis.revenue_change_pct}
        />
        <KPICard
          label="Transactions"
          value={(kpis.transactions || 0).toLocaleString()}
          change={kpis.transactions_change_pct}
        />
        <KPICard
          label="Average Check"
          value={formatCurrency(kpis.avg_check || 0)}
          change={kpis.avg_check_change_pct}
        />
      </div>

      {/* Narrative Section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <h2 className="font-medium text-navy-900 dark:text-white">AI Narrative</h2>
            <select
              value={narrativeStyle}
              onChange={(e) => setNarrativeStyle(e.target.value as NarrativeStyle)}
              disabled={!isOperator || isSent}
              className="text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            >
              <option value="full">Full Summary</option>
              <option value="bullets">Bullet Points</option>
            </select>
          </div>
          {isOperator && !isSent && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRegenerate}
                disabled={regenerateMutation.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
              >
                {regenerateMutation.isPending ? <Spinner size="sm" /> : <RefreshCw className="h-3 w-3" />}
                Regenerate
              </button>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                >
                  <Edit3 className="h-3 w-3" />
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={handleSaveNarrative}
                    disabled={updateMutation.isPending}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-navy-600 hover:bg-navy-700 rounded transition-colors disabled:opacity-50"
                  >
                    {updateMutation.isPending ? <Spinner size="sm" /> : <Save className="h-3 w-3" />}
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setEditedNarrative(report.narrative_text || '')
                      setIsEditing(false)
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <div className="p-4">
          {isOperator && isEditing ? (
            <textarea
              value={editedNarrative}
              onChange={(e) => setEditedNarrative(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white resize-y"
            />
          ) : (
            <div className="prose dark:prose-invert max-w-none whitespace-pre-wrap text-slate-700 dark:text-slate-300">
              {report.narrative_text || 'No narrative generated.'}
            </div>
          )}
        </div>
      </div>

      {/* Data Sections Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Items */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-medium text-navy-900 dark:text-white">Top Performers</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {topItems.length > 0 ? (
              topItems.map((item, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-navy-900 dark:text-white">{item.item_name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.category}</p>
                  </div>
                  <p className="font-medium text-navy-900 dark:text-white">
                    {formatCurrency(item.revenue)}
                  </p>
                </div>
              ))
            ) : (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 text-center">
                No top items data
              </p>
            )}
          </div>
        </div>

        {/* Movers */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-medium text-navy-900 dark:text-white">Movers</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {gainers.slice(0, 3).map((item, i) => (
              <div key={`g-${i}`} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  <p className="font-medium text-navy-900 dark:text-white">{item.item_name}</p>
                </div>
                <span className="text-sm text-emerald-600">
                  {item.change_pct > 500 ? 'New/Trending' : `+${item.change_pct.toFixed(1)}%`}
                </span>
              </div>
            ))}
            {decliners.slice(0, 3).map((item, i) => (
              <div key={`d-${i}`} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <p className="font-medium text-navy-900 dark:text-white">{item.item_name}</p>
                </div>
                <span className="text-sm text-red-600">
                  {item.change_pct <= -100 ? 'Discontinued' : `${item.change_pct.toFixed(1)}%`}
                </span>
              </div>
            ))}
            {gainers.length === 0 && decliners.length === 0 && (
              <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 text-center">
                No mover data
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Alerts Section - Only for weekly reports */}
      {report.period_type === 'week' && alerts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-800">
            <h2 className="font-medium text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Active Alerts ({alerts.length})
            </h2>
          </div>
          <div className="divide-y divide-amber-200 dark:divide-amber-800">
            {alerts.map((alert, i) => (
              <div key={i} className="px-4 py-3">
                <p className="font-medium text-amber-900 dark:text-amber-100">{alert.title}</p>
                {alert.message && (
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{alert.message}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Modal */}
      {isOperator && showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowSendModal(false)} />
          <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-navy-900 dark:text-white mb-4">
              Send Report
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Enter email or leave blank for default"
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Leave blank to use tenant's configured email
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sendMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {sendMutation.isPending && <Spinner size="sm" />}
                <Send className="h-4 w-4" />
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
