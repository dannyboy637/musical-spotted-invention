import type { SyncStatus } from '../../../../hooks/useOperator'
import { Spinner } from '../../../../components/ui/Spinner'
import { Database, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface DataPipelineStatusProps {
  syncStatus: SyncStatus[]
  isLoading: boolean
}

export function DataPipelineStatus({ syncStatus, isLoading }: DataPipelineStatusProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <Database size={18} className="text-slate-500" />
        <h3 className="font-semibold text-navy-900">Data Pipeline Status</h3>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : syncStatus.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-sm">No tenants found</div>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2 font-medium text-slate-600">Tenant</th>
                <th className="px-4 py-2 font-medium text-slate-600">Status</th>
                <th className="px-4 py-2 font-medium text-slate-600">Last Sync</th>
                <th className="px-4 py-2 font-medium text-slate-600 text-right">Rows</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {syncStatus.map((status) => (
                <SyncRow key={status.tenant_id} status={status} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function SyncRow({ status }: { status: SyncStatus }) {
  const getStatusDisplay = () => {
    switch (status.status) {
      case 'completed':
        return {
          icon: CheckCircle,
          color: 'text-emerald-600',
          label: 'Completed',
        }
      case 'processing':
        return {
          icon: Clock,
          color: 'text-amber-600',
          label: 'Processing',
        }
      case 'failed':
        return {
          icon: XCircle,
          color: 'text-red-600',
          label: 'Failed',
        }
      case 'never':
      default:
        return {
          icon: AlertCircle,
          color: 'text-slate-400',
          label: 'Never',
        }
    }
  }

  const statusDisplay = getStatusDisplay()
  const StatusIcon = statusDisplay.icon

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-2">
        <span className="font-medium text-navy-900">{status.tenant_name}</span>
      </td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5">
          <StatusIcon size={14} className={statusDisplay.color} />
          <span className={`text-sm ${statusDisplay.color}`}>{statusDisplay.label}</span>
        </div>
        {status.error_message && (
          <p className="text-xs text-red-600 mt-0.5 line-clamp-1" title={status.error_message}>
            {status.error_message}
          </p>
        )}
      </td>
      <td className="px-4 py-2 text-slate-600">
        {status.last_import_at
          ? formatDistanceToNow(new Date(status.last_import_at), { addSuffix: true })
          : '—'}
      </td>
      <td className="px-4 py-2 text-right text-slate-600">
        {status.row_count > 0 ? status.row_count.toLocaleString() : '—'}
      </td>
    </tr>
  )
}
