import { createContext, useContext, useCallback, type ReactNode } from 'react'
import { usePersistentState } from '@/hooks/useLocalStorage'

interface HistoryItem {
  id: number
  type: 'movie' | 'tv'
  title: string
  currentTime: number
  duration: number
  updated: number
}

interface HistoryContextType {
  items: HistoryItem[]
  add: (item: Omit<HistoryItem, 'updated'>) => void
  remove: (id: number, type: string) => void
  clear: () => void
}

const HistoryContext = createContext<HistoryContextType | null>(null)

const HISTORY_KEY = 'spiflix-watch-history'
const MAX_ITEMS = 100

export function HistoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = usePersistentState<HistoryItem[]>(HISTORY_KEY, [])

  const add = useCallback((item: Omit<HistoryItem, 'updated'>) => {
    setItems(prev => {
      const filtered = prev.filter(i => !(i.id === item.id && i.type === item.type))
      return [{ ...item, updated: Date.now() }, ...filtered].slice(0, MAX_ITEMS)
    })
  }, [setItems])

  const remove = useCallback((id: number, type: string) => {
    setItems(prev => prev.filter(i => !(i.id === id && i.type === type)))
  }, [setItems])

  const clear = useCallback(() => {
    setItems([])
  }, [setItems])

  return (
    <HistoryContext.Provider value={{ items, add, remove, clear }}>
      {children}
    </HistoryContext.Provider>
  )
}

export function useHistory() {
  const ctx = useContext(HistoryContext)
  if (!ctx) throw new Error('useHistory must be used within HistoryProvider')
  return ctx
}
