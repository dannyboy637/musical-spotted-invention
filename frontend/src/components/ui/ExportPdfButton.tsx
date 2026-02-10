import { Download } from 'lucide-react'
import { exportSectionToPdf } from '../../lib/exportPdf'

interface ExportPdfButtonProps {
  title: string
  targetId: string
}

export function ExportPdfButton({ title, targetId }: ExportPdfButtonProps) {
  return (
    <button
      data-no-print
      onClick={() => exportSectionToPdf({ title, targetId })}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-navy-700 text-white rounded-md hover:bg-navy-800 transition-colors"
    >
      <Download size={14} />
      Export PDF
    </button>
  )
}
