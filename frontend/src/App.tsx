import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { useAuthStore } from './stores/authStore'
import { LoginPage } from './modules/auth/LoginPage'
import { ForgotPasswordPage } from './modules/auth/ForgotPasswordPage'
import { DashboardPage } from './modules/dashboard/DashboardPage'
import { TimeIntelligencePage } from './modules/time-intelligence'
import { MenuEngineeringPage } from './modules/menu-engineering'
import { CategoryPage } from './modules/categories'
import { BranchComparisonPage } from './modules/branches'
import { PerformancePage } from './modules/performance'
import { RecommendationsPage } from './modules/recommendations'
import { CostManagementPage } from './modules/costs'
import { DataManagementPage } from './modules/data-management'
import { AlertsPage } from './modules/alerts'
import { ReportsPage, ReportPreviewPage } from './modules/reports'
import { OperatorHub } from './modules/operator'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { PublicRoute } from './components/layout/PublicRoute'
import { AppShell } from './components/layout/AppShell'
import { Spinner } from './components/ui/Spinner'

function App() {
  const { initialize, isInitialized } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

          {/* Protected routes with AppShell layout */}
          <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="menu-engineering" element={<MenuEngineeringPage />} />
            <Route path="time-intelligence" element={<TimeIntelligencePage />} />
            <Route path="performance" element={<PerformancePage />} />
            <Route path="categories" element={<CategoryPage />} />
            <Route path="branches" element={<BranchComparisonPage />} />
            <Route path="recommendations" element={<RecommendationsPage />} />
            <Route path="costs" element={<CostManagementPage />} />
            <Route path="data-management" element={<DataManagementPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="reports/:id" element={<ReportPreviewPage />} />
            <Route path="operator" element={<OperatorHub />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
