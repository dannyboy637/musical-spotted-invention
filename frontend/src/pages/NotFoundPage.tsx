import { Link } from 'react-router-dom'
import { FileQuestion, Home } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-navy-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileQuestion className="w-10 h-10 text-navy-600" />
        </div>

        <h1 className="text-3xl font-bold text-navy-900 mb-2">
          Page not found
        </h1>

        <p className="text-slate-600 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors font-medium"
        >
          <Home className="w-5 h-5" />
          Go to Dashboard
        </Link>
      </div>
    </div>
  )
}
