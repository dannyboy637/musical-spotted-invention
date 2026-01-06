import { useState } from 'react'
import { useErrorLogs } from '../../../../hooks/useOperator'
import type { ErrorLog as ErrorLogType } from '../../../../hooks/useOperator'
import { Spinner } from '../../../../components/ui/Spinner'
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ErrorLogProps {
  timeRange: number
}

export function ErrorLog({ timeRange }: ErrorLogProps) {
  const { data, isLoading } = useErrorLogs({ hours: timeRange, limit: 20 })
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle size={18} className="text-red-500" />
          <h3 className="font-semibold text-navy-900">Error Log</h3>
        </div>
        {data && data.total > 0 && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            {data.total} errors
          </span>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : !data || data.errors.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            No errors in the selected time range
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.errors.map((error) => (
              <ErrorItem
                key={error.id}
                error={error}
                isExpanded={expandedId === error.id}
                onToggle={() => setExpandedId(expandedId === error.id ? null : error.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ErrorItem({
  error,
  isExpanded,
  onToggle,
}: {
  error: ErrorLogType
  isExpanded: boolean
  onToggle: () => void
}) {
  const statusColor =
    error.status_code >= 500
      ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700'

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-start gap-3">
          {isExpanded ? (
            <ChevronDown size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColor}`}>
                {error.status_code}
              </span>
              <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                {error.method}
              </span>
              <span className="text-sm font-mono text-navy-900 truncate">{error.endpoint}</span>
            </div>
            <p className="text-sm text-slate-600 line-clamp-1">
              {error.error_message || 'No error message'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {formatDistanceToNow(new Date(error.created_at), { addSuffix: true })}
              {error.duration_ms && ` • ${error.duration_ms}ms`}
            </p>
          </div>
        </div>
      </button>

      {isExpanded && error.stack_trace && (
        <div className="px-4 pb-4 pl-12">
          <div className="bg-slate-900 rounded-md p-3 overflow-x-auto">
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">
              {error.stack_trace}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
