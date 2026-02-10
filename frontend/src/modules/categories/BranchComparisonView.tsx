import { useMemo } from 'react'
import { Building2 } from 'lucide-react'
import { ChartContainer } from '../../components/charts/ChartContainer'
import { BarChart } from '../../components/charts/BarChart'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { useCategoryByBranch } from '../../hooks/useAnalytics'
import type { BranchCategoryData } from '../../hooks/useAnalytics'
import { formatCurrency, getChartColor } from '../../lib/chartConfig'

interface BranchComparisonViewProps {
  selectedCategory: string | null
}

export function BranchComparisonView({ selectedCategory }: BranchComparisonViewProps) {
  const { data, isLoading, error, refetch } = useCategoryByBranch(selectedCategory)

  // Transform data for bar chart
  const chartData = useMemo(() => {
    if (!data?.branches) return []
    return data.branches.map((b, i) => ({
      name: b.branch.replace(/^Spotted Pig Cafe - /, ''), // Shorten branch names
      revenue: b.revenue,
      quantity: b.quantity,
      color: getChartColor(i),
    }))
  }, [data])

  const columns: Column<BranchCategoryData>[] = [
    {
      key: 'branch',
      header: 'Branch',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-2">
          <Building2 size={14} className="text-slate-400" />
          <span className="font-medium">{value as string}</span>
        </div>
      ),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'quantity',
      header: 'Qty Sold',
      align: 'right',
      sortable: true,
      render: (value) => (value as number).toLocaleString(),
    },
    {
      key: 'avg_price',
      header: 'Avg Price',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'item_count',
      header: 'Items',
      align: 'right',
      sortable: true,
    },
    {
      key: 'percentage_of_branch',
      header: '% of Branch',
      align: 'right',
      sortable: true,
      render: (value) => `${(value as number).toFixed(1)}%`,
    },
    {
      key: 'top_item',
      header: 'Top Item',
      sortable: true,
    },
  ]

  if (!selectedCategory) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-300 rounded-lg p-12 text-center">
        <Building2 className="mx-auto h-8 w-8 text-slate-400 mb-3" />
        <p className="text-slate-600 font-medium">Select a category to compare across branches</p>
        <p className="text-sm text-slate-500 mt-1">Click a category in the table above</p>
      </div>
    )
  }

  const branches = data?.branches || []

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-navy-900">
        {selectedCategory} by Branch
      </h3>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart */}
        <ChartContainer
          title="Revenue by Branch"
          subtitle={`${selectedCategory} performance comparison`}
          loading={isLoading}
          empty={chartData.length === 0}
          error={error as Error | null}
          onRetry={() => refetch()}
          emptyMessage="No branch data found"
          skeletonType="bar"
          height={300}
        >
          <BarChart
            data={chartData}
            xKey="name"
            bars={[{ key: 'revenue', name: 'Revenue', color: getChartColor(0) }]}
            height={280}
          />
        </ChartContainer>

        {/* Branch Table */}
        <ChartContainer
          title="Branch Breakdown"
          subtitle={`${branches.length} branches`}
          loading={isLoading}
          empty={branches.length === 0}
          error={error as Error | null}
          onRetry={() => refetch()}
          emptyMessage="No branch data found"
          skeletonType="bar"
        >
          <div className="max-h-72 overflow-y-auto">
            <DataTable columns={columns} data={branches} keyField="branch" compact />
          </div>
        </ChartContainer>
      </div>
    </div>
  )
}
