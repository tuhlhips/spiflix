import { useEffect, type ReactNode } from 'react'
import Lenis from 'lenis'
import { useIsMobile } from '@/hooks/use-mobile'

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile()

  useEffect(() => {
    if (isMobile) return
    const lenis = new Lenis({
      autoRaf: true,
    })
    return () => lenis.destroy()
  }, [isMobile])

  return <>{children}</>
}
