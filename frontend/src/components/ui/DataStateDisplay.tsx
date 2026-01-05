import { AlertCircle, RefreshCw, Database, BarChart3 } from 'lucide-react'

type StateType = 'error' | 'empty' | 'no-data'

interface DataStateDisplayProps {
  type: StateType
  title: string
  message: string
  onRetry?: () => void
  retryLabel?: string
}

const icons: Record<StateType, React.ReactNode> = {
  error: <AlertCircle size={48} strokeWidth={1.5} className="text-red-400 mb-3" />,
  empty: <BarChart3 size={48} strokeWidth={1.5} className="text-slate-300 mb-3" />,
  'no-data': <Database size={48} strokeWidth={1.5} className="text-slate-300 mb-3" />,
}

const borderColors: Record<StateType, string> = {
  error: 'border-red-200',
  empty: 'border-slate-200',
  'no-data': 'border-slate-200',
}

export function DataStateDisplay({
  type,
  title,
  message,
  onRetry,
  retryLabel = 'Try again',
}: DataStateDisplayProps) {
  return (
    <div className={`bg-white rounded-lg border ${borderColors[type]} p-8`}>
      <div className="flex flex-col items-center text-center">
        {icons[type]}
        <h3 className="text-lg font-medium text-slate-800 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-4 max-w-md">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-navy-600 hover:text-navy-800 hover:bg-slate-100 rounded-md transition-colors"
          >
            <RefreshCw size={14} />
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  )
}
