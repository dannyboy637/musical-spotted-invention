import { Info } from 'lucide-react'

interface InfoTooltipProps {
  text: string
  size?: number
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export function InfoTooltip({ text, size = 14, position = 'top' }: InfoTooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800',
  }

  return (
    <span className="group relative inline-flex items-center">
      <Info
        size={size}
        className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 cursor-help"
      />
      <span
        className={`invisible group-hover:visible absolute ${positionClasses[position]} px-3 py-2 text-xs text-white bg-slate-800 rounded-lg whitespace-normal w-48 text-center shadow-lg z-50`}
      >
        {text}
        <span
          className={`absolute ${arrowClasses[position]} border-4 border-transparent`}
        />
      </span>
    </span>
  )
}
