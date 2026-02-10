import { format } from 'date-fns'
import { useFilterStore } from '../stores/filterStore'

interface ExportPdfOptions {
  title: string
  targetId: string
}

export function exportSectionToPdf({ title, targetId }: ExportPdfOptions) {
  const target = document.getElementById(targetId)
  if (!target) return

  const { dateRange, branches, categories } = useFilterStore.getState()
  const dateRangeText = dateRange
    ? `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`
    : 'All time'

  const filterLines = [
    `Date Range: ${dateRangeText}`,
    `Branches: ${branches.length ? branches.join(', ') : 'All'}`,
    `Categories: ${categories.length ? categories.join(', ') : 'All'}`,
  ]

  const clone = target.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-no-print]').forEach((el) => el.remove())

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('\n')

  const printWindow = window.open('', '_blank', 'height=900,width=1200')
  if (!printWindow) return

  printWindow.document.write(`
    <html>
      <head>
        <title>${title} Report</title>
        ${styles}
        <style>
          body { background: #fff; padding: 24px; font-family: system-ui, -apple-system, sans-serif; }
          .print-header { border-bottom: 1px solid #e5e7eb; margin-bottom: 16px; padding-bottom: 12px; }
          .print-header h1 { font-size: 20px; margin: 0 0 4px 0; color: #0f172a; }
          .print-header p { margin: 2px 0; color: #475569; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1>Restaurant Analytics · ${title}</h1>
          ${filterLines.map((line) => `<p>${line}</p>`).join('')}
        </div>
        ${clone.innerHTML}
      </body>
    </html>
  `)

  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
  printWindow.close()
}
