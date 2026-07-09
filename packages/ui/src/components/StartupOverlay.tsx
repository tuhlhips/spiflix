import { useEffect, useState } from 'react'
import { Film } from 'lucide-react'

export function StartupOverlay() {
  const [phase, setPhase] = useState<'loading' | 'brand' | 'done'>('loading')

  useEffect(() => {
    const skip = sessionStorage.getItem('spiflix-startup-seen')
    if (skip) { setPhase('done'); return }

    const t1 = setTimeout(() => setPhase('brand'), 1500)
    const t2 = setTimeout(() => {
      setPhase('done')
      sessionStorage.setItem('spiflix-startup-seen', 'true')
    }, 2800)

    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (phase === 'done') return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
      {phase === 'loading' && (
        <div className="flex flex-col items-center gap-6">
          <div className="h-12 w-12 animate-spin rounded-full border-3 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
        </div>
      )}

      {phase === 'brand' && (
        <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
          <Film className="h-16 w-16 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">Spiflix</h1>
          <p className="text-sm text-muted-foreground">Stream movies and TV shows</p>
        </div>
      )}
    </div>
  )
}
