import { useState } from 'react'
import { ChevronDown, ChevronRight, Clock, CheckCircle, XCircle, Loader2, Ban, Trash2 } from 'lucide-react'
import { useImportJobs, useCancelImportJob, useDeleteImportJob } from '../../hooks/useDataManagement'
import type { ImportJob } from '../../hooks/useDataManagement'
import { Spinner } from '../../components/ui/Spinner'
import { useAuthStore } from '../../stores/authStore'

const statusConfig = {
  pending: { icon: Clock, color: 'bg-amber-100 text-amber-700', label: 'Pending' },
  processing: { icon: Loader2, color: 'bg-blue-100 text-blue-700', label: 'Processing' },
  completed: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700', label: 'Completed' },
  failed: { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Failed' },
  cancelled: { icon: Ban, color: 'bg-slate-100 text-slate-600', label: 'Cancelled' },
  deleted: { icon: Trash2, color: 'bg-slate-100 text-slate-500', label: 'Deleted' },
}

function StatusBadge({ status }: { status: ImportJob['status'] }) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
      <Icon size={12} className={status === 'processing' ? 'animate-spin' : ''} />
      {config.label}
    </span>
  )
}

function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start || !end) return '-'
  const startDate = new Date(start)
  const endDate = new Date(end)
  return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

interface JobRowProps {
  job: ImportJob
  onCancel?: (jobId: string) => void
  onDelete?: (jobId: string) => void
  cancellingJobId?: string | null
  deletingJobId?: string | null
  isOperator?: boolean
}

function JobRow({ job, onCancel, onDelete, cancellingJobId, deletingJobId, isOperator }: JobRowProps) {
  const [expanded, setExpanded] = useState(false)

  const errorList = job.error_details?.errors || []
  const duplicateCount = job.error_details?.duplicate_skipped || 0
  const hasErrors = job.error_message || (job.error_rows && job.error_rows > 0)
  const hasDetails = hasErrors || duplicateCount > 0

  const canCancel = (job.status === 'pending' || job.status === 'processing') && onCancel
  const canDelete = (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && onDelete
  const isCancelling = cancellingJobId === job.id
  const isDeleting = deletingJobId === job.id

  return (
    <>
      <tr
        className={`hover:bg-slate-50 ${hasDetails ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {hasDetails && (
              expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />
            )}
            <span className="font-medium text-slate-800 text-sm">{job.file_name}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={job.status} />
        </td>
        {isOperator && (
          <td className="px-4 py-3 text-sm text-slate-700">
            {job.tenant_name || <span className="text-slate-400">—</span>}
          </td>
        )}
        <td className="px-4 py-3 text-right text-sm text-slate-700">
          {job.status === 'completed' ? (
            <>
              {job.inserted_rows?.toLocaleString() || 0}
              {job.total_rows && (
                <span className="text-slate-400"> / {job.total_rows.toLocaleString()}</span>
              )}
              {duplicateCount > 0 && (
                <span className="text-amber-600 ml-1" title="Duplicate rows skipped">
                  ({duplicateCount.toLocaleString()} dup)
                </span>
              )}
            </>
          ) : job.status === 'processing' ? (
            <>
              {job.processed_rows?.toLocaleString() || 0}
              {job.total_rows && (
                <span className="text-slate-400"> / {job.total_rows.toLocaleString()}</span>
              )}
            </>
          ) : (
            <span className="text-slate-400">-</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-slate-600">
          {formatDateRange(job.date_range_start, job.date_range_end)}
        </td>
        <td className="px-4 py-3 text-sm">
          <span className="text-slate-500">{formatRelativeTime(job.created_at)}</span>
        </td>
        <td className="px-4 py-3 text-right">
          {canCancel && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Cancel this import? Any imported transactions will be deleted.')) {
                  onCancel(job.id)
                }
              }}
              disabled={isCancelling}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              title="Cancel import"
            >
              <Ban size={12} />
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                const count = job.inserted_rows || 0
                if (confirm(`Delete this import and all ${count.toLocaleString()} transactions? This cannot be undone.`)) {
                  onDelete(job.id)
                }
              }}
              disabled={isDeleting}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete import and transactions"
            >
              <Trash2 size={12} />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </td>
      </tr>
      {expanded && hasDetails && (
        <tr>
          <td colSpan={isOperator ? 7 : 6} className={`px-4 py-3 border-t ${hasErrors ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
            <div className="text-sm">
              {hasErrors && (
                <>
                  <p className="font-medium text-red-800 mb-1">Error Details</p>
                  <p className="text-red-700">{job.error_message || 'Unknown error'}</p>
                  {job.error_rows && job.error_rows > 0 && (
                    <p className="text-red-600 mt-1">{job.error_rows} rows had errors</p>
                  )}
                  {errorList.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {errorList.slice(0, 5).map((err, i) => (
                        <p key={i} className="text-xs text-red-600 font-mono">
                          Row {err.row}: {err.error}
                        </p>
                      ))}
                      {errorList.length > 5 && (
                        <p className="text-xs text-red-500">
                          ...and {errorList.length - 5} more errors
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
              {duplicateCount > 0 && (
                <div className={hasErrors ? 'mt-3 pt-3 border-t border-amber-200' : ''}>
                  <p className="font-medium text-amber-800 mb-1">Duplicate Rows Skipped</p>
                  <p className="text-amber-700">
                    {duplicateCount.toLocaleString()} rows already existed in the database and were skipped.
                  </p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export function ImportHistoryTable() {
  const { data: jobs, isLoading, error, refetch } = useImportJobs(20, 0, { pollingWhileProcessing: true })
  const cancelMutation = useCancelImportJob()
  const deleteMutation = useDeleteImportJob()
  const { profile } = useAuthStore()
  const isOperator = profile?.role === 'operator'

  // Track which job is currently being operated on
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null)
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null)

  const handleCancel = async (jobId: string) => {
    setCancellingJobId(jobId)
    try {
      await cancelMutation.mutateAsync(jobId)
    } catch {
      alert('Failed to cancel import. Please try again.')
    } finally {
      setCancellingJobId(null)
    }
  }

  const handleDelete = async (jobId: string) => {
    setDeletingJobId(jobId)
    try {
      const result = await deleteMutation.mutateAsync(jobId)
      alert(`Import deleted. ${result.transactions_deleted} transactions removed.`)
    } catch (err: unknown) {
      // Extract error message from axios response
      const axiosError = err as { response?: { data?: { detail?: string } } }
      const detail = axiosError?.response?.data?.detail || 'Unknown error'
      alert(`Failed to delete import: ${detail}`)
    } finally {
      setDeletingJobId(null)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-navy-900">Import History</h2>
        <p className="text-sm text-slate-500 mt-1">Recent CSV imports and their status</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
          <span className="ml-2 text-sm text-slate-500">Loading import history...</span>
        </div>
      ) : error ? (
        <div className="p-6 text-center">
          <p className="text-red-600 mb-2">Failed to load import history</p>
          <button
            onClick={() => refetch()}
            className="text-sm text-navy-600 hover:text-navy-700"
          >
            Try again
          </button>
        </div>
      ) : !jobs || jobs.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-slate-600 mb-1">No imports yet</p>
          <p className="text-sm text-slate-400">Upload a CSV file to get started</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                  File
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                  Status
                </th>
                {isOperator && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                    Tenant
                  </th>
                )}
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                  Rows
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                  Date Range
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                  Imported
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  onCancel={handleCancel}
                  onDelete={handleDelete}
                  cancellingJobId={cancellingJobId}
                  deletingJobId={deletingJobId}
                  isOperator={isOperator}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
