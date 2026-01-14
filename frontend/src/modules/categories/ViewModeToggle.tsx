import { LayoutList, GitCompare, Building2 } from 'lucide-react'
import type { ViewMode } from './CategoryPage'

interface ViewModeToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

const modes: { value: ViewMode; label: string; icon: typeof LayoutList; description: string }[] = [
  {
    value: 'single',
    label: 'Single',
    icon: LayoutList,
    description: 'Deep dive into one category',
  },
  {
    value: 'compare',
    label: 'Compare',
    icon: GitCompare,
    description: 'Compare multiple categories',
  },
  {
    value: 'branch',
    label: 'By Branch',
    icon: Building2,
    description: 'Category across branches',
  },
]

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-slate-600">View:</span>
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
        {modes.map((mode) => {
          const Icon = mode.icon
          const isActive = value === mode.value

          return (
            <button
              key={mode.value}
              onClick={() => onChange(mode.value)}
              title={mode.description}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? 'bg-white text-navy-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800 hover:bg-slate-100'
              }`}
            >
              <Icon size={14} />
              <span>{mode.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
