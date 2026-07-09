import { Outlet } from 'react-router-dom'
import { Header } from '../../components/layout/Header'
import { Footer } from '../../components/layout/Footer'

export function AppLayout() {
  return (
    <div className="relative min-h-screen">
      {/* Background gradient blobs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] h-[50vh] w-[50vh] rounded-full bg-primary/60 blur-[128px]" />
        <div className="absolute top-1/2 right-[-10%] h-[40vh] w-[40vh] rounded-full bg-primary/20 blur-[96px]" />
        <div className="absolute bottom-[-20%] left-1/2 h-[50vh] w-[50vh] rounded-full bg-primary/10 blur-3xl" />
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
