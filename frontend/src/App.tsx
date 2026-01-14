import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { queryClient } from './lib/queryClient'
import { useAuthStore } from './stores/authStore'
import { useTheme } from './hooks/useTheme'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { PublicRoute } from './components/layout/PublicRoute'
import { AppShell } from './components/layout/AppShell'
import { Spinner } from './components/ui/Spinner'
import { PageSkeleton } from './components/ui/PageSkeleton'
import { NotFoundPage } from './pages/NotFoundPage'

// Lazy load all page components for code splitting
const LoginPage = lazy(() => import('./modules/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const ForgotPasswordPage = lazy(() => import('./modules/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })))
const DashboardPage = lazy(() => import('./modules/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const TimeIntelligencePage = lazy(() => import('./modules/time-intelligence').then(m => ({ default: m.TimeIntelligencePage })))
const MenuEngineeringPage = lazy(() => import('./modules/menu-engineering').then(m => ({ default: m.MenuEngineeringPage })))
const CategoryPage = lazy(() => import('./modules/categories').then(m => ({ default: m.CategoryPage })))
const BranchComparisonPage = lazy(() => import('./modules/branches').then(m => ({ default: m.BranchComparisonPage })))
const PerformancePage = lazy(() => import('./modules/performance').then(m => ({ default: m.PerformancePage })))
const RecommendationsPage = lazy(() => import('./modules/recommendations').then(m => ({ default: m.RecommendationsPage })))
const CostManagementPage = lazy(() => import('./modules/costs').then(m => ({ default: m.CostManagementPage })))
const DataManagementPage = lazy(() => import('./modules/data-management').then(m => ({ default: m.DataManagementPage })))
const AlertsPage = lazy(() => import('./modules/alerts').then(m => ({ default: m.AlertsPage })))
const ReportsPage = lazy(() => import('./modules/reports').then(m => ({ default: m.ReportsPage })))
const ReportPreviewPage = lazy(() => import('./modules/reports').then(m => ({ default: m.ReportPreviewPage })))
const OperatorHub = lazy(() => import('./modules/operator').then(m => ({ default: m.OperatorHub })))

// Page loading fallback
function PageLoader() {
  return <PageSkeleton type="dashboard" />
}

function App() {
  const { initialize, isInitialized } = useAuthStore()

  // Sync theme preference to document
  useTheme()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

              {/* Protected routes with AppShell layout */}
              <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
                <Route index element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
                <Route path="menu-engineering" element={<Suspense fallback={<PageLoader />}><MenuEngineeringPage /></Suspense>} />
                <Route path="time-intelligence" element={<Suspense fallback={<PageLoader />}><TimeIntelligencePage /></Suspense>} />
                <Route path="performance" element={<Suspense fallback={<PageLoader />}><PerformancePage /></Suspense>} />
                <Route path="categories" element={<Suspense fallback={<PageLoader />}><CategoryPage /></Suspense>} />
                <Route path="branches" element={<Suspense fallback={<PageLoader />}><BranchComparisonPage /></Suspense>} />
                <Route path="recommendations" element={<Suspense fallback={<PageLoader />}><RecommendationsPage /></Suspense>} />
                <Route path="costs" element={<Suspense fallback={<PageLoader />}><CostManagementPage /></Suspense>} />
                <Route path="data-management" element={<Suspense fallback={<PageLoader />}><DataManagementPage /></Suspense>} />
                <Route path="alerts" element={<Suspense fallback={<PageLoader />}><AlertsPage /></Suspense>} />
                <Route path="reports" element={<Suspense fallback={<PageLoader />}><ReportsPage /></Suspense>} />
                <Route path="reports/:id" element={<Suspense fallback={<PageLoader />}><ReportPreviewPage /></Suspense>} />
                <Route path="operator" element={<Suspense fallback={<PageLoader />}><OperatorHub /></Suspense>} />
              </Route>

              {/* 404 catch-all */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>

      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: '#102a43',
            color: '#f0f4f8',
            borderRadius: '8px',
          },
        }}
      />
    </QueryClientProvider>
  )
}

export default App
