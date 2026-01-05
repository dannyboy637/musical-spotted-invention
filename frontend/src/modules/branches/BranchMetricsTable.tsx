import { ChartContainer } from '../../components/charts/ChartContainer'
import { DataTable } from '../../components/ui/DataTable'
import type { Column } from '../../components/ui/DataTable'
import { usePerformanceBranches } from '../../hooks/useAnalytics'
import type { BranchData } from '../../hooks/useAnalytics'
import { formatCurrency, formatPercent } from '../../lib/chartConfig'

export function BranchMetricsTable() {
  const { data, isLoading } = usePerformanceBranches()

  const columns: Column<BranchData>[] = [
    {
      key: 'name',
      header: 'Branch',
      sortable: true,
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
    {
      key: 'percentage_of_total',
      header: '% of Total',
      align: 'right',
      sortable: true,
      render: (value) => formatPercent(value as number),
    },
    {
      key: 'transactions',
      header: 'Transactions',
      align: 'right',
      sortable: true,
      render: (value) => (value as number).toLocaleString(),
    },
    {
      key: 'avg_ticket',
      header: 'Avg Ticket',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrency(value as number),
    },
  ]

  return (
    <ChartContainer
      title="Branch Metrics"
      subtitle="Detailed comparison of all branches"
      loading={isLoading}
      empty={!data?.branches?.length}
      emptyMessage="No branch data available"
      skeletonType="bar"
    >
      <div className="px-1">
        <DataTable
          columns={columns}
          data={data?.branches || []}
          keyField="name"
          compact
        />
      </div>
    </ChartContainer>
  )
}
