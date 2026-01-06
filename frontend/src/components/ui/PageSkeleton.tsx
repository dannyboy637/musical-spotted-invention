import { ChartSkeleton } from '../charts/ChartSkeleton'

interface PageSkeletonProps {
  type?: 'dashboard' | 'list' | 'detail'
}

export function PageSkeleton({ type = 'dashboard' }: PageSkeletonProps) {
  const baseClass = 'animate-pulse bg-slate-200 rounded'

  if (type === 'list') {
    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className={`${baseClass} h-8 w-48`} />
          <div className={`${baseClass} h-10 w-32`} />
        </div>

        {/* List items */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-lg border border-slate-200">
              <div className={`${baseClass} w-10 h-10 rounded-full`} />
              <div className="flex-1 space-y-2">
                <div className={`${baseClass} h-4 w-2/3`} />
                <div className={`${baseClass} h-3 w-1/3`} />
              </div>
              <div className={`${baseClass} h-6 w-20`} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'detail') {
    return (
      <div className="p-6 space-y-6">
        {/* Back button and title */}
        <div className="flex items-center gap-4">
          <div className={`${baseClass} w-8 h-8 rounded`} />
          <div className={`${baseClass} h-8 w-64`} />
        </div>

        {/* Content card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div className={`${baseClass} h-6 w-48`} />
          <div className="space-y-3">
            <div className={`${baseClass} h-4 w-full`} />
            <div className={`${baseClass} h-4 w-5/6`} />
            <div className={`${baseClass} h-4 w-4/6`} />
          </div>
        </div>
      </div>
    )
  }

  // Default: dashboard layout
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className={`${baseClass} h-8 w-48`} />
        <div className="flex gap-2">
          <div className={`${baseClass} h-10 w-32`} />
          <div className={`${baseClass} h-10 w-32`} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className={`${baseClass} h-4 w-24`} />
            <div className={`${baseClass} h-8 w-32`} />
            <div className={`${baseClass} h-3 w-16`} />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className={`${baseClass} h-6 w-32 mb-4`} />
          <ChartSkeleton type="line" height={250} />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className={`${baseClass} h-6 w-32 mb-4`} />
          <ChartSkeleton type="bar" height={250} />
        </div>
      </div>
    </div>
  )
}
