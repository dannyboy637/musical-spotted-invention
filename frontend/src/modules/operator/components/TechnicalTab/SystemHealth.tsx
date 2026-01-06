import { Activity, Database, Shield, Globe } from 'lucide-react'
import type { SystemHealth as SystemHealthType } from '../../../../hooks/useOperator'
import { Spinner } from '../../../../components/ui/Spinner'

interface SystemHealthProps {
  health: SystemHealthType | undefined
  isLoading: boolean
}

export function SystemHealth({ health, isLoading }: SystemHealthProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-center">
          <Spinner />
        </div>
      </div>
    )
  }

  const services = [
    {
      name: 'API',
      icon: Activity,
      status: health?.api?.status ?? 'unknown',
      message: health?.api?.message ?? 'Checking...',
    },
    {
      name: 'Database',
      icon: Database,
      status: health?.database?.status ?? 'unknown',
      message: health?.database?.message ?? 'Checking...',
    },
    {
      name: 'Auth',
      icon: Shield,
      status: health?.auth?.status ?? 'unknown',
      message: health?.auth?.message ?? 'Checking...',
    },
    {
      name: 'Frontend',
      icon: Globe,
      status: 'healthy',
      message: 'Running',
    },
  ]

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-100">
        <h3 className="font-semibold text-navy-900">System Health</h3>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100">
        {services.map((service) => {
          const statusColors = {
            healthy: { bg: 'bg-emerald-100', dot: 'bg-emerald-500', text: 'text-emerald-700' },
            unhealthy: { bg: 'bg-red-100', dot: 'bg-red-500', text: 'text-red-700' },
            unknown: { bg: 'bg-slate-100', dot: 'bg-slate-400', text: 'text-slate-600' },
          }
          const colors = statusColors[service.status as keyof typeof statusColors] ?? statusColors.unknown

          return (
            <div key={service.name} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <service.icon size={18} className="text-slate-500" />
                <span className="font-medium text-navy-900">{service.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                <span className={`text-sm capitalize ${colors.text}`}>
                  {service.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 truncate" title={service.message}>
                {service.message}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
