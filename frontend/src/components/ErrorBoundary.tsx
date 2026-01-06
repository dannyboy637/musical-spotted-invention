import { Component, type ReactNode } from 'react'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

// Wrapper to access auth store in class component
function ErrorFallback({
  error,
  errorInfo,
  onReset
}: {
  error: Error | null
  errorInfo: React.ErrorInfo | null
  onReset: () => void
}) {
  const profile = useAuthStore((s) => s.profile)
  const isOperator = profile?.role === 'operator'

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>

        <h1 className="text-2xl font-bold text-navy-900 mb-2">
          Something went wrong
        </h1>

        <p className="text-slate-600 mb-6">
          {isOperator
            ? 'An error occurred while rendering this page. Technical details are shown below.'
            : 'We encountered an unexpected error. Please try refreshing the page or go back to the dashboard.'}
        </p>

        {/* Technical details for operators only */}
        {isOperator && error && (
          <div className="mb-6 text-left">
            <details className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <summary className="cursor-pointer text-sm font-medium text-slate-700 mb-2">
                Technical Details
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase mb-1">Error</p>
                  <pre className="text-sm text-red-600 bg-red-50 p-2 rounded overflow-x-auto">
                    {error.message}
                  </pre>
                </div>
                {errorInfo?.componentStack && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase mb-1">Component Stack</p>
                    <pre className="text-xs text-slate-600 bg-slate-100 p-2 rounded overflow-x-auto max-h-40">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      )
    }

    return this.props.children
  }
}
