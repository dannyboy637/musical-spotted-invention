import { X } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { DayDeepDiveContent } from './DayDeepDiveContent'

export function DayDeepDiveModal() {
  const { dayDeepDiveOpen, dayDeepDiveDate, closeDayDeepDive } = useUIStore()

  if (!dayDeepDiveOpen || !dayDeepDiveDate) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={closeDayDeepDive} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 z-10">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Day Deep Dive</h2>
            <button
              onClick={closeDayDeepDive}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            <DayDeepDiveContent date={dayDeepDiveDate} />
          </div>
        </div>
      </div>
    </>
  )
}
