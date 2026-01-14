interface StatCardProps {
  label: string
  value: string
  sublabel?: string
  note?: string
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  loading?: boolean
}

export function StatCard({
  label,
  value,
  sublabel,
  note,
  color = 'default',
  loading = false,
}: StatCardProps) {
  const getColorClasses = () => {
    switch (color) {
      case 'success':
        return 'bg-emerald-50 border-emerald-200'
      case 'warning':
        return 'bg-amber-50 border-amber-200'
      case 'danger':
        return 'bg-red-50 border-red-200'
      case 'info':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-white border-slate-200'
    }
  }

  const getValueColor = () => {
    switch (color) {
      case 'success':
        return 'text-emerald-700'
      case 'warning':
        return 'text-amber-700'
      case 'danger':
        return 'text-red-700'
      case 'info':
        return 'text-blue-700'
      default:
        return 'text-navy-900'
    }
  }

  if (loading) {
    return (
      <div className={`border rounded-lg p-4 ${getColorClasses()}`}>
        <div className="animate-pulse">
          <div className="h-3 bg-slate-200 rounded w-1/2 mb-2"></div>
          <div className="h-6 bg-slate-200 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={`border rounded-lg p-4 ${getColorClasses()}`}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${getValueColor()}`}>{value}</p>
      {sublabel && <p className="mt-1 text-xs text-slate-400">{sublabel}</p>}
      {note && <p className="mt-1 text-xs text-amber-600 italic">{note}</p>}
    </div>
  )
}
