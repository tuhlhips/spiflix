import { useEffect, useState } from 'react'
import { Film } from 'lucide-react'

/**
 * Brief brand splash, once per session. Kept short (900ms) — anything longer
 * is pure theater that delays first interaction.
 */
export function StartupOverlay() {
  const [done, setDone] = useState(() => {
    try { return sessionStorage.getItem('spiflix-startup-seen') === 'true' } catch { return true }
  })

  useEffect(() => {
    if (done) return
    const t = setTimeout(() => {
      setDone(true)
      try { sessionStorage.setItem('spiflix-startup-seen', 'true') } catch {}
    }, 900)
    return () => clearTimeout(t)
  }, [done])

  if (done) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
        <Film className="h-16 w-16 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Spiflix</h1>
        <p className="text-sm text-muted-foreground">Stream movies and TV shows</p>
      </div>
    </div>
  )
}
