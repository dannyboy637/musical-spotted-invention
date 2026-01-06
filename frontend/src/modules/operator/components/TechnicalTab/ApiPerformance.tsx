import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { ApiMetricsResponse } from '../../../../hooks/useOperator'
import { Spinner } from '../../../../components/ui/Spinner'
import { format } from 'date-fns'

interface ApiPerformanceProps {
  metrics: ApiMetricsResponse | undefined
  isLoading: boolean
}

export function ApiPerformance({ metrics, isLoading }: ApiPerformanceProps) {
  const summary = metrics?.summary

  // Format hourly data for chart
  const chartData = (metrics?.hourly_metrics ?? []).map((h) => ({
    hour: format(new Date(h.hour), 'HH:mm'),
    requests: h.request_count,
    avgMs: h.avg_response_ms,
    errors: h.error_count,
  }))

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="font-semibold text-navy-900">API Performance</h3>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-100">
            <StatBox label="Total Requests" value={summary?.total_requests ?? 0} />
            <StatBox label="Avg Response" value={`${summary?.avg_response_ms?.toFixed(0) ?? 0}ms`} />
            <StatBox label="Error Rate" value={`${summary?.error_rate_pct ?? 0}%`} />
            <StatBox
              label="Slow Endpoints"
              value={summary?.slow_endpoint_count ?? 0}
              highlight={summary?.slow_endpoint_count ? summary.slow_endpoint_count > 0 : false}
            />
          </div>

          {/* Chart */}
          <div className="p-4">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="requests"
                    name="Requests"
                    stroke="#1e3a5f"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgMs"
                    name="Avg ms"
                    stroke="#b45309"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-slate-500 text-sm">
                No metrics data yet. Data will appear after API usage.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatBox({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div className="p-3 text-center">
      <div className={`text-lg font-semibold ${highlight ? 'text-amber-600' : 'text-navy-900'}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}
