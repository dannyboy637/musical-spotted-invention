export type PeriodOption = 'month' | 'quarter' | 'half-year' | 'year'

export function getDateRangeForPeriod(period: PeriodOption): { startDate: string; endDate: string } {
  const end = new Date()
  const start = new Date()

  switch (period) {
    case 'month':
      start.setDate(start.getDate() - 30)
      break
    case 'quarter':
      start.setDate(start.getDate() - 90)
      break
    case 'half-year':
      start.setDate(start.getDate() - 180)
      break
    case 'year':
      start.setDate(start.getDate() - 365)
      break
  }

  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  }
}
