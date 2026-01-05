import { Star, TrendingDown, HelpCircle, XCircle } from 'lucide-react'
import { useMenuEngineering } from '../../hooks/useAnalytics'
import { quadrantColors } from '../../lib/chartConfig'

const quadrantInfo = [
  {
    key: 'Star',
    label: 'Stars',
    description: 'High profit, high popularity',
    icon: Star,
    color: quadrantColors.Star,
    bgColor: 'bg-emerald-50',
  },
  {
    key: 'Plowhorse',
    label: 'Plowhorses',
    description: 'Low profit, high popularity',
    icon: TrendingDown,
    color: quadrantColors.Plowhorse,
    bgColor: 'bg-blue-50',
  },
  {
    key: 'Puzzle',
    label: 'Puzzles',
    description: 'High profit, low popularity',
    icon: HelpCircle,
    color: quadrantColors.Puzzle,
    bgColor: 'bg-amber-50',
  },
  {
    key: 'Dog',
    label: 'Dogs',
    description: 'Low profit, low popularity',
    icon: XCircle,
    color: quadrantColors.Dog,
    bgColor: 'bg-slate-50',
  },
]

interface QuadrantSummaryProps {
  selectedQuadrant: string | null
  onQuadrantClick: (quadrant: string | null) => void
  macroCategory?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  minQuantity?: number | null
}

export function QuadrantSummary({
  selectedQuadrant,
  onQuadrantClick,
  macroCategory,
  minPrice,
  maxPrice,
  minQuantity,
}: QuadrantSummaryProps) {
  const { data, isLoading } = useMenuEngineering({ macroCategory, minPrice, maxPrice, minQuantity })

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {quadrantInfo.map((q) => {
        const count = data?.quadrant_summary?.[q.key] || 0
        const isSelected = selectedQuadrant === q.key
        const Icon = q.icon

        return (
          <button
            key={q.key}
            onClick={() => onQuadrantClick(isSelected ? null : q.key)}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              isSelected
                ? 'border-navy-600 shadow-md'
                : 'border-transparent hover:border-slate-300'
            } ${q.bgColor}`}
            disabled={isLoading}
          >
            <div className="flex items-center gap-2 mb-1">
              <Icon
                className="w-5 h-5"
                style={{ color: q.color }}
              />
              <span className="font-semibold text-slate-800">{q.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {isLoading ? '-' : count}
            </p>
            <p className="text-xs text-slate-500 mt-1">{q.description}</p>
          </button>
        )
      })}
    </div>
  )
}
