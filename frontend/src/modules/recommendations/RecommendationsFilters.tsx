import { Calendar } from 'lucide-react'
import type { PeriodOption } from './recommendationsUtils'

interface RecommendationsFiltersProps {
  selectedPeriod: PeriodOption
  onPeriodChange: (period: PeriodOption) => void
  selectedBranch: string | null
  onBranchChange: (branch: string | null) => void
  availableBranches: string[]
}

const PERIOD_OPTIONS: { value: PeriodOption; label: string; description: string }[] = [
  { value: 'month', label: 'Last Month', description: '30 days' },
  { value: 'quarter', label: 'Last Quarter', description: '90 days' },
  { value: 'half-year', label: 'Last 6 Mo', description: '180 days' },
  { value: 'year', label: 'Full Year', description: '365 days' },
]

export function RecommendationsFilters({
  selectedPeriod,
  onPeriodChange,
  selectedBranch,
  onBranchChange,
  availableBranches,
}: RecommendationsFiltersProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-4">
        {/* Period label */}
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Calendar size={16} />
          <span className="font-medium">Period:</span>
        </div>

        {/* Period pills */}
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => onPeriodChange(option.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                selectedPeriod === option.value
                  ? 'bg-navy-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title={option.description}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200" />

        {/* Branch selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600 font-medium">Branch:</label>
          <select
            value={selectedBranch || ''}
            onChange={(e) => onBranchChange(e.target.value || null)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent min-w-[150px]"
          >
            <option value="">All Branches</option>
            {availableBranches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
