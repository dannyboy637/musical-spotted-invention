interface TableSkeletonProps {
  rows?: number
  columns?: number
  showHeader?: boolean
}

export function TableSkeleton({ rows = 5, columns = 4, showHeader = true }: TableSkeletonProps) {
  const baseClass = 'animate-pulse bg-slate-200 rounded'

  return (
    <div className="w-full overflow-hidden">
      <table className="w-full">
        {showHeader && (
          <thead>
            <tr className="border-b border-slate-200">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <div className={`${baseClass} h-4 w-24`} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} className="border-b border-slate-100">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex} className="px-4 py-3">
                  <div
                    className={`${baseClass} h-4`}
                    style={{
                      width: colIndex === 0 ? '60%' : `${40 + Math.random() * 30}%`,
                    }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
