import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'

interface DrawerPayload {
  id: number
  type: 'movie' | 'tv'
}

interface DrawerContextType {
  payload: DrawerPayload | null
  open: (payload: DrawerPayload) => void
  close: () => void
}

const DrawerContext = createContext<DrawerContextType | null>(null)

function parsePayload(media: string | null): DrawerPayload | null {
  if (!media) return null
  const [type, id] = media.split(':')
  const numericId = Number(id)
  return (type === 'movie' || type === 'tv') && /^\d+$/.test(id || '') && Number.isSafeInteger(numericId) && numericId > 0
    ? { type, id: numericId }
    : null
}

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams()
  const [payload, setPayload] = useState<DrawerPayload | null>(() => {
    return parsePayload(searchParams.get('media'))
  })

  // Sync URL to state on mount (for deep linking)
  useEffect(() => {
    setPayload(parsePayload(searchParams.get('media')))
  }, [searchParams])

  const open = useCallback((p: DrawerPayload) => {
    setPayload(p)
    // Sync to URL without using searchParams setter (avoid transition delay)
    const url = new URL(window.location.href)
    url.searchParams.set('media', `${p.type}:${p.id}`)
    window.history.replaceState(null, '', url.toString())
  }, [])

  const close = useCallback(() => {
    setPayload(null)
    const url = new URL(window.location.href)
    url.searchParams.delete('media')
    window.history.replaceState(null, '', url.toString())
  }, [])

  return (
    <DrawerContext.Provider value={{ payload, open, close }}>
      {children}
    </DrawerContext.Provider>
  )
}

export function useDrawer() {
  const ctx = useContext(DrawerContext)
  if (!ctx) throw new Error('useDrawer must be used within DrawerProvider')
  return ctx
}
