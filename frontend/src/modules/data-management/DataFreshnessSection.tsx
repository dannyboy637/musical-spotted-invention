import { Database, FileText, AlertTriangle, CheckCircle } from 'lucide-react'
import { useDataHealth, useImportJobs } from '../../hooks/useDataManagement'
import { Spinner } from '../../components/ui/Spinner'

export function DataFreshnessSection() {
  const { data: health, isLoading: healthLoading } = useDataHealth()
  const { data: jobs } = useImportJobs(1, 0) // Get most recent job

  const lastImport = jobs?.[0]
  const transactionCount = typeof health?.counts.transactions === 'number'
    ? health.counts.transactions
    : 0
  const menuItemCount = typeof health?.counts.menu_items === 'number'
    ? health.counts.menu_items
    : 0
  const issues: string[] = health?.issues || []

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  if (healthLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-center py-4">
          <Spinner size="md" />
          <span className="ml-2 text-sm text-slate-500">Loading data status...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <Database size={16} />
            <span className="text-xs font-medium uppercase">Transactions</span>
          </div>
          <p className="text-2xl font-semibold text-navy-900">
            {formatNumber(transactionCount)}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <FileText size={16} />
            <span className="text-xs font-medium uppercase">Menu Items</span>
          </div>
          <p className="text-2xl font-semibold text-navy-900">
            {formatNumber(menuItemCount)}
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <CheckCircle size={16} />
            <span className="text-xs font-medium uppercase">Last Import</span>
          </div>
          <p className="text-sm font-medium text-navy-900">
            {lastImport ? formatDate(lastImport.completed_at || lastImport.created_at) : 'Never'}
          </p>
          {lastImport?.status === 'completed' && lastImport.inserted_rows && (
            <p className="text-xs text-slate-500 mt-0.5">
              {formatNumber(lastImport.inserted_rows)} rows
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-500 mb-1">
            <FileText size={16} />
            <span className="text-xs font-medium uppercase">Data Range</span>
          </div>
          {health?.date_range?.start && health?.date_range?.end ? (
            <>
              <p className="text-sm font-medium text-navy-900">
                {new Date(health.date_range.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' - '}
                {new Date(health.date_range.end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </>
          ) : (
            <p className="text-sm font-medium text-slate-400">No data</p>
          )}
        </div>
      </div>

      {/* Issues/Warnings */}
      {issues.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-800">Data Issues Detected</h3>
              <ul className="mt-1 space-y-1">
                {issues.map((issue, i) => (
                  <li key={i} className="text-sm text-amber-700">{issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
