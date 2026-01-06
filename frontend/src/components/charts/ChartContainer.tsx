import { BarChart3, AlertCircle, RefreshCw, type LucideIcon } from 'lucide-react';
import { ChartSkeleton } from './ChartSkeleton';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyIcon?: LucideIcon;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  emptyActionHref?: string;
  error?: Error | null;
  onRetry?: () => void;
  skeletonType?: 'line' | 'bar' | 'donut' | 'heatmap' | 'scatter';
  height?: number;
  children: React.ReactNode;
}

export function ChartContainer({
  title,
  subtitle,
  loading = false,
  empty = false,
  emptyMessage = 'No data available',
  emptyDescription,
  emptyIcon: EmptyIcon = BarChart3,
  emptyActionLabel,
  onEmptyAction,
  emptyActionHref,
  error = null,
  onRetry,
  skeletonType = 'bar',
  height = 300,
  children,
}: ChartContainerProps) {
  const ActionWrapper = emptyActionHref ? 'a' : 'button'
  const actionProps = emptyActionHref
    ? { href: emptyActionHref }
    : { onClick: onEmptyAction, type: 'button' as const }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm overflow-hidden">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        )}
      </div>

      {loading ? (
        <ChartSkeleton type={skeletonType} height={height} />
      ) : error ? (
        <div
          className="flex flex-col items-center justify-center text-slate-500"
          style={{ height }}
        >
          <AlertCircle size={48} strokeWidth={1.5} className="mb-3 text-red-400" />
          <p className="text-sm text-slate-600 mb-2">
            {/* Handle axios error structure */}
            {(error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
             error.message ||
             'Failed to load data'}
          </p>
          {/* Show status code if available */}
          {(error as { response?: { status?: number } })?.response?.status && (
            <p className="text-xs text-slate-400 mb-3">
              Status: {(error as { response?: { status?: number } }).response?.status}
            </p>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 text-sm text-navy-600 hover:text-navy-800 hover:bg-slate-100 rounded-md transition-colors"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          )}
        </div>
      ) : empty ? (
        <div
          className="flex flex-col items-center justify-center text-center px-4"
          style={{ height }}
        >
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
            <EmptyIcon size={24} className="text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">{emptyMessage}</p>
          {emptyDescription && (
            <p className="text-xs text-slate-400 max-w-xs mb-4">{emptyDescription}</p>
          )}
          {emptyActionLabel && (onEmptyAction || emptyActionHref) && (
            <ActionWrapper
              {...actionProps}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-navy-700 text-white rounded-md hover:bg-navy-800 transition-colors"
            >
              {emptyActionLabel}
            </ActionWrapper>
          )}
        </div>
      ) : (
        <div style={{ height }} className="overflow-auto">{children}</div>
      )}
    </div>
  );
}
