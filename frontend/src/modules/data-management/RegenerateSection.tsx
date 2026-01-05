import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useRegenerateMenuItems } from '../../hooks/useAnalytics'
import { useQueryClient } from '@tanstack/react-query'

export function RegenerateSection() {
  const [lastResult, setLastResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null)
  const regenerateMutation = useRegenerateMenuItems()
  const queryClient = useQueryClient()

  const handleRegenerate = async () => {
    setLastResult(null)
    try {
      const result = await regenerateMutation.mutateAsync()
      setLastResult({ success: true, count: result.menu_items_updated })
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['data-health'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-overview'] })
      queryClient.invalidateQueries({ queryKey: ['analytics-categories'] })
    } catch (err) {
      setLastResult({
        success: false,
        error: err instanceof Error ? err.message : 'Regeneration failed',
      })
    }
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-navy-900 mb-4">Menu Item Aggregation</h2>

      {/* Info box */}
      <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg mb-4">
        <Info size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-slate-600">
          <p>
            Regenerates aggregated menu item data from transactions. This runs automatically
            after each CSV import, but you can trigger it manually if needed.
          </p>
          <p className="mt-1 text-slate-500">
            Use this after data cleanup or if menu items appear stale.
          </p>
        </div>
      </div>

      {/* Action button */}
      <button
        onClick={handleRegenerate}
        disabled={regenerateMutation.isPending}
        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors ${
          regenerateMutation.isPending
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-navy-600 text-white hover:bg-navy-700'
        }`}
      >
        <RefreshCw size={18} className={regenerateMutation.isPending ? 'animate-spin' : ''} />
        {regenerateMutation.isPending ? 'Regenerating...' : 'Regenerate Menu Items'}
      </button>

      {/* Result message */}
      {lastResult && (
        <div className={`mt-4 flex items-center gap-2 p-3 rounded-lg ${
          lastResult.success ? 'bg-emerald-50' : 'bg-red-50'
        }`}>
          {lastResult.success ? (
            <>
              <CheckCircle size={16} className="text-emerald-600" />
              <span className="text-sm text-emerald-700">
                Updated {lastResult.count?.toLocaleString()} menu items
              </span>
            </>
          ) : (
            <>
              <AlertCircle size={16} className="text-red-600" />
              <span className="text-sm text-red-700">{lastResult.error}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
