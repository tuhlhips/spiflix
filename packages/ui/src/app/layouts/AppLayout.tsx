import { Outlet } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Footer } from '../../components/layout/Footer'

export function AppLayout() {
  return (
    <div className="relative min-h-screen">
      {/* Background gradient */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute top-[-20%] left-[-10%] h-[50vh] w-[50vh] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[50vh] w-[50vh] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative z-10">
        <Header />
        <main className="min-h-[calc(100vh-4rem)]">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  )
}
