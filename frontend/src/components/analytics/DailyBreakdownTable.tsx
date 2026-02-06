import { useMemo } from 'react'
import { Download } from 'lucide-react'
import { format } from 'date-fns'
import { useDailyBreakdown } from '../../hooks/useAnalytics'
import { useUIStore } from '../../stores/uiStore'
import { DataTable, type Column } from '../ui/DataTable'
import { formatCurrencyFull } from '../../lib/chartConfig'

interface DailyBreakdownRow {
  date: string
  net_sales: number
  tax: number
  service_charge: number
  discounts: number
  transactions: number
}

export function DailyBreakdownTable() {
  const { data, isLoading, error, refetch } = useDailyBreakdown()
  const { openDayDeepDive } = useUIStore()

  const rows = useMemo<DailyBreakdownRow[]>(() => data?.days ?? [], [data?.days])

  const columns: Column<DailyBreakdownRow>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      getValue: (row) => row.date,
      render: (value) => format(new Date(value as string), 'MMM d, yyyy'),
    },
    {
      key: 'net_sales',
      header: 'Net Sales',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrencyFull(value as number),
    },
    {
      key: 'tax',
      header: 'Tax',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrencyFull(value as number),
    },
    {
      key: 'service_charge',
      header: 'Service Charge',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrencyFull(value as number),
    },
    {
      key: 'discounts',
      header: 'Discounts',
      align: 'right',
      sortable: true,
      render: (value) => formatCurrencyFull(value as number),
    },
    {
      key: 'transactions',
      header: 'Transactions',
      align: 'right',
      sortable: true,
    },
  ]

  const handleExport = () => {
    if (!rows.length) return
    const header = ['Date', 'Net Sales', 'Tax', 'Service Charge', 'Discounts', 'Transactions']
    const lines = rows.map((row) => [
      row.date,
      (row.net_sales / 100).toFixed(2),
      (row.tax / 100).toFixed(2),
      (row.service_charge / 100).toFixed(2),
      (row.discounts / 100).toFixed(2),
      row.transactions.toString(),
    ])
    const csv = [header, ...lines].map((line) => line.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'daily_breakdown.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <div className="h-6 w-40 bg-slate-100 rounded mb-3" />
        <div className="h-4 w-64 bg-slate-100 rounded mb-6" />
        <div className="h-40 bg-slate-50 rounded" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Daily Breakdown</h3>
            <p className="text-sm text-slate-500 mt-1">Revenue reconciliation by day</p>
          </div>
        </div>
        <div className="text-sm text-slate-600">
          {(error as Error).message || 'Failed to load daily breakdown.'}
          <button
            onClick={() => refetch()}
            className="ml-3 text-navy-600 hover:text-navy-800"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800">Daily Breakdown</h3>
        <p className="text-sm text-slate-500 mt-1">Revenue reconciliation by day</p>
        <div className="text-sm text-slate-500 mt-4">No daily data available.</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">Daily Breakdown</h3>
          <p className="text-sm text-slate-500 mt-1">Revenue reconciliation by day</p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-navy-700 text-white rounded-md hover:bg-navy-800 transition-colors"
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        keyField="date"
        compact
        onRowClick={(row) => openDayDeepDive(row.date)}
      />
    </div>
  )
}
