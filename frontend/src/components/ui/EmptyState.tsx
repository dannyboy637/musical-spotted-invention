import { type LucideIcon, Inbox } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
}: EmptyStateProps) {
  const ActionWrapper = actionHref ? 'a' : 'button'
  const actionProps = actionHref
    ? { href: actionHref }
    : { onClick: onAction, type: 'button' as const }

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>

      <h3 className="text-lg font-semibold text-navy-900 mb-1">
        {title}
      </h3>

      {description && (
        <p className="text-slate-600 max-w-sm mb-6">
          {description}
        </p>
      )}

      {actionLabel && (onAction || actionHref) && (
        <ActionWrapper
          {...actionProps}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors font-medium"
        >
          {actionLabel}
        </ActionWrapper>
      )}
    </div>
  )
}
