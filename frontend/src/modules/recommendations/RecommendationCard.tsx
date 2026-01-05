import { TrendingUp, Scissors, Package } from 'lucide-react'
import type { Recommendation } from './ruleEngine'
import { quadrantColors } from '../../lib/chartConfig'

interface RecommendationCardProps {
  recommendation: Recommendation
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const { type, priority, title, description, item, metrics } = recommendation

  const getIcon = () => {
    switch (type) {
      case 'promote':
        return <TrendingUp className="w-5 h-5" />
      case 'cut':
        return <Scissors className="w-5 h-5" />
      case 'bundle':
        return <Package className="w-5 h-5" />
    }
  }

  const getTypeStyles = () => {
    switch (type) {
      case 'promote':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-200',
          icon: 'text-emerald-600',
          badge: 'bg-emerald-100 text-emerald-700',
        }
      case 'cut':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'text-red-600',
          badge: 'bg-red-100 text-red-700',
        }
      case 'bundle':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'text-blue-600',
          badge: 'bg-blue-100 text-blue-700',
        }
    }
  }

  const getPriorityBadge = () => {
    switch (priority) {
      case 'high':
        return 'bg-amber-100 text-amber-700'
      case 'medium':
        return 'bg-slate-100 text-slate-600'
      case 'low':
        return 'bg-slate-50 text-slate-500'
    }
  }

  const styles = getTypeStyles()

  return (
    <div className={`${styles.bg} border ${styles.border} rounded-lg p-4`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${styles.bg} ${styles.icon}`}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-slate-800 truncate">{title}</h4>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPriorityBadge()}`}>
              {priority}
            </span>
          </div>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
      </div>

      {/* Metrics */}
      {metrics && Object.keys(metrics).length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-200/50">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {Object.entries(metrics).map(([key, value]) => (
              <div key={key} className="text-xs">
                <span className="text-slate-500">{key}:</span>{' '}
                <span className="font-medium text-slate-700">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quadrant indicator for item recommendations */}
      {item && (
        <div className="mt-2">
          <span
            className="inline-flex items-center gap-1 text-xs"
            style={{ color: quadrantColors[item.quadrant] }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: quadrantColors[item.quadrant] }}
            />
            {item.quadrant} • {item.category}
          </span>
        </div>
      )}
    </div>
  )
}
