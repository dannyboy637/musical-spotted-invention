import { useState } from 'react'
import { ChevronDown, ChevronRight, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useImportJobs } from '../../hooks/useDataManagement'
import type { ImportJob } from '../../hooks/useDataManagement'
import { Spinner } from '../../components/ui/Spinner'

const statusConfig = {
  pending: { icon: Clock, color: 'bg-amber-100 text-amber-700', label: 'Pending' },
  processing: { icon: Loader2, color: 'bg-blue-100 text-blue-700', label: 'Processing' },
  completed: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700', label: 'Completed' },
  failed: { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Failed' },
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

function JobRow({ job }: { job: ImportJob }) {
  const [expanded, setExpanded] = useState(false)

  const hasErrors = job.error_message || (job.error_rows && job.error_rows > 0)

  return (
    <>
      <tr
        className={`hover:bg-slate-50 ${hasErrors ? 'cursor-pointer' : ''}`}
        onClick={() => hasErrors && setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {hasErrors && (
              expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />
            )}
            <span className="font-medium text-slate-800 text-sm">{job.file_name}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <StatusBadge status={job.status} />
        </td>
        <td className="px-4 py-3 text-right text-sm text-slate-700">
          {job.status === 'completed' ? (
            <>
              {job.inserted_rows?.toLocaleString() || 0}
              {job.total_rows && (
                <span className="text-slate-400"> / {job.total_rows.toLocaleString()}</span>
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
        <td className="px-4 py-3 text-sm text-slate-500">
          {formatRelativeTime(job.created_at)}
        </td>
      </tr>
      {expanded && hasErrors && (
        <tr>
          <td colSpan={5} className="px-4 py-3 bg-red-50 border-t border-red-100">
            <div className="text-sm">
              <p className="font-medium text-red-800 mb-1">Error Details</p>
              <p className="text-red-700">{job.error_message || 'Unknown error'}</p>
              {job.error_rows && job.error_rows > 0 && (
                <p className="text-red-600 mt-1">{job.error_rows} rows had errors</p>
              )}
              {job.error_details && job.error_details.length > 0 && (
                <div className="mt-2 space-y-1">
                  {job.error_details.slice(0, 5).map((err, i) => (
                    <p key={i} className="text-xs text-red-600 font-mono">
                      Row {(err as { row?: number }).row}: {(err as { error?: string }).error}
                    </p>
                  ))}
                  {job.error_details.length > 5 && (
                    <p className="text-xs text-red-500">
                      ...and {job.error_details.length - 5} more errors
                    </p>
                  )}
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
  const { data: jobs, isLoading, error, refetch } = useImportJobs(20, 0)

  // Check if any job is processing - if so, enable auto-refresh
  const hasProcessingJob = jobs?.some(j => j.status === 'pending' || j.status === 'processing')

  // Refetch every 3 seconds if there's a processing job
  if (hasProcessingJob) {
    setTimeout(() => refetch(), 3000)
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
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase">
                  Rows
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                  Date Range
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">
                  Imported
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <JobRow key={job.id} job={job} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
