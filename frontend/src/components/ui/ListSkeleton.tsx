interface ListSkeletonProps {
  items?: number
  showAvatar?: boolean
  showMeta?: boolean
}

export function ListSkeleton({ items = 5, showAvatar = false, showMeta = true }: ListSkeletonProps) {
  const baseClass = 'animate-pulse bg-slate-200 rounded'

  return (
    <div className="w-full space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-200"
        >
          {showAvatar && (
            <div className={`${baseClass} w-10 h-10 rounded-full flex-shrink-0`} />
          )}
          <div className="flex-1 min-w-0 space-y-2">
            <div className={`${baseClass} h-4 w-3/4`} />
            {showMeta && (
              <div className={`${baseClass} h-3 w-1/2`} />
            )}
          </div>
          <div className={`${baseClass} h-6 w-16 flex-shrink-0`} />
        </div>
      ))}
    </div>
  )
}
