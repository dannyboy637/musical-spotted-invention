import { Construction } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 bg-navy-100 rounded-full flex items-center justify-center mb-4">
        <Construction size={32} className="text-navy-600" />
      </div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-2">{title}</h1>
      <p className="text-slate-500">This page is coming soon.</p>
    </div>
  )
}
