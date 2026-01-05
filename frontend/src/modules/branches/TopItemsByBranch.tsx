import { ChartContainer } from '../../components/charts/ChartContainer'
import { usePerformanceBranches } from '../../hooks/useAnalytics'

export function TopItemsByBranch() {
  const { data, isLoading } = usePerformanceBranches()

  const branches = data?.branches || []

  return (
    <ChartContainer
      title="Top Items by Branch"
      subtitle="Best sellers at each location"
      loading={isLoading}
      empty={branches.length === 0}
      emptyMessage="No branch data available"
      skeletonType="bar"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-1">
        {branches.map((branch) => (
          <div
            key={branch.name}
            className="bg-slate-50 rounded-lg p-4"
          >
            <h4 className="font-semibold text-navy-900 mb-3">{branch.name}</h4>
            <ol className="space-y-2">
              {branch.top_items?.slice(0, 5).map((item, index) => (
                <li key={item.item} className="flex items-start gap-2">
                  <span className="w-5 h-5 flex items-center justify-center bg-navy-100 text-navy-700 text-xs font-medium rounded-full flex-shrink-0">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700 truncate">{item.item}</p>
                    <p className="text-xs text-slate-500">{item.quantity} sold</p>
                  </div>
                </li>
              ))}
              {(!branch.top_items || branch.top_items.length === 0) && (
                <li className="text-sm text-slate-500">No items data</li>
              )}
            </ol>
          </div>
        ))}
      </div>
    </ChartContainer>
  )
}
