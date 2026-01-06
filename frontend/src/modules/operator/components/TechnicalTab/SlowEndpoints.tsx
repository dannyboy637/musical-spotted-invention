import type { SlowEndpoint } from '../../../../hooks/useOperator'
import { Spinner } from '../../../../components/ui/Spinner'
import { AlertTriangle } from 'lucide-react'

interface SlowEndpointsProps {
  endpoints: SlowEndpoint[]
  isLoading: boolean
}

export function SlowEndpoints({ endpoints, isLoading }: SlowEndpointsProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" />
          <h3 className="font-semibold text-navy-900">Slow Endpoints</h3>
          <span className="text-xs text-slate-500">&gt;300ms avg</span>
        </div>
        {endpoints.length > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            {endpoints.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : endpoints.length === 0 ? (
        <div className="py-8 text-center text-slate-500 text-sm">
          No slow endpoints detected
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-4 py-2 font-medium text-slate-600">Endpoint</th>
                <th className="px-4 py-2 font-medium text-slate-600 text-right">Avg</th>
                <th className="px-4 py-2 font-medium text-slate-600 text-right">P95</th>
                <th className="px-4 py-2 font-medium text-slate-600 text-right">Calls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {endpoints.map((ep, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded mr-2">
                      {ep.method}
                    </span>
                    <span className="text-navy-900 font-mono text-xs">{ep.endpoint}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`font-medium ${
                        ep.avg_response_ms > 500 ? 'text-red-600' : 'text-amber-600'
                      }`}
                    >
                      {ep.avg_response_ms.toFixed(0)}ms
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {ep.p95_response_ms.toFixed(0)}ms
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {ep.call_count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
