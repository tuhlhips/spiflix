import { createContext, useContext, useCallback, type ReactNode } from 'react'
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

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const mediaParam = searchParams.get('media')

  const payload: DrawerPayload | null = mediaParam
    ? (() => {
        const [type, id] = mediaParam.split(':')
        if (type && id) return { type: type as 'movie' | 'tv', id: Number(id) }
        return null
      })()
    : null

  const open = useCallback((p: DrawerPayload) => {
    setSearchParams({ media: `${p.type}:${p.id}` }, { replace: true })
  }, [setSearchParams])

  const close = useCallback(() => {
    setSearchParams({}, { replace: true })
  }, [setSearchParams])

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
