import { Outlet, useLocation } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Footer } from '../../components/layout/Footer'
import { MobileTabBar } from '../../components/layout/MobileTabBar'
import { ErrorBoundary } from '../../components/ErrorBoundary'

export function AppLayout() {
  const location = useLocation()
  return (
    <div className="relative min-h-screen">
      {/* Background gradient blobs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] h-[50vh] w-[50vh] rounded-full bg-primary/60 blur-[128px]" />
        <div className="absolute top-1/2 right-[-10%] h-[40vh] w-[40vh] rounded-full bg-primary/20 blur-[96px]" />
        <div className="absolute bottom-[-20%] left-1/2 h-[50vh] w-[50vh] rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Extra bottom padding on phones so content and footer clear the fixed
          mobile tab bar; removed from `sm` up where the bar is hidden. */}
      <div className="relative z-10 pb-[68px] sm:pb-0">
        <Header />
        <main className="min-h-[calc(100vh-4rem)]">
          {/* Scope render errors to the routed page so the shell (header/nav)
              survives, and reset the boundary on navigation. */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
        <Footer />
      </div>

      <MobileTabBar />
    </div>
  )
}
