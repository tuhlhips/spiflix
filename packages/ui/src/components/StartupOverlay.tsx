import { useEffect, useState } from 'react'
import { Film } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Brief brand splash, once per session.
 *
 * Skipped entirely when launched as an installed PWA: the OS already shows its
 * own splash (built from the manifest icon + background_color), so rendering
 * ours on top stacks two splashes back to back — which is what made mobile feel
 * slow regardless of the timing here.
 *
 * In a browser tab phones get a much shorter beat than desktop; the delay to
 * first interaction is felt more on mobile. The enter animation scales with it,
 * otherwise the overlay dismisses mid-fade and reads as a flicker.
 */
const SPLASH_MS_MOBILE = 475
const SPLASH_MS_DESKTOP = 900

/** True when running as an installed app rather than a browser tab. */
function isStandalone(): boolean {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

export function StartupOverlay() {
  const [done, setDone] = useState(() => {
    try {
      return sessionStorage.getItem('spiflix-startup-seen') === 'true' || isStandalone()
    } catch {
      return true
    }
  })
  // Matches the `sm` breakpoint the mobile shell uses elsewhere.
  const [isMobile] = useState(() => {
    try { return window.matchMedia('(max-width: 640px)').matches } catch { return false }
  })

  useEffect(() => {
    if (done) return
    const t = setTimeout(() => {
      setDone(true)
      try { sessionStorage.setItem('spiflix-startup-seen', 'true') } catch {}
    }, isMobile ? SPLASH_MS_MOBILE : SPLASH_MS_DESKTOP)
    return () => clearTimeout(t)
  }, [done, isMobile])

  if (done) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background">
      <div
        className={cn(
          'flex flex-col items-center gap-4 animate-in fade-in zoom-in-95',
          isMobile ? 'duration-300' : 'duration-500',
        )}
      >
        <Film className="h-16 w-16 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Spiflix</h1>
        <p className="text-sm text-muted-foreground">Stream movies and TV shows</p>
      </div>
    </div>
  )
}
