import { format } from 'date-fns'
import { useFilterStore } from '../../stores/filterStore'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  const { dateRange } = useFilterStore()

  const dateRangeText = dateRange
    ? `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`
    : null

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy-900 dark:text-white">
          {title}
          {dateRangeText && (
            <span className="text-slate-400 font-normal ml-2">
              &middot; {dateRangeText}
            </span>
          )}
        </h1>
        {subtitle && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="pt-1">{actions}</div>}
    </div>
  )
}
