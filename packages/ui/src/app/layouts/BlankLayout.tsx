import { Outlet, useLocation } from 'react-router-dom'
import { ErrorBoundary } from '../../components/ErrorBoundary'

export function BlankLayout() {
  const location = useLocation()
  return (
    <div className="min-h-screen bg-background">
      <ErrorBoundary key={location.pathname}>
        <Outlet />
      </ErrorBoundary>
    </div>
  )
}
