import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react'
import { usePersistentState } from '@/hooks/useLocalStorage'
import { useProfiles } from './profiles-provider'

export interface SavedTitle {
  id: number
  type: 'movie' | 'tv'
  title: string
  posterPath: string | null
  rating?: number
  releaseDate?: string
}

/** Composite identity — movie 550 and tv 550 are different titles. */
function key(id: number, type: 'movie' | 'tv') {
  return `${type}:${id}`
}

interface SavedListContextType {
  /** Saved titles for the active profile, most-recent-first. */
  items: SavedTitle[]
  count: number
  isSaved: (id: number, type: 'movie' | 'tv') => boolean
  toggle: (title: SavedTitle) => void
  remove: (id: number, type: 'movie' | 'tv') => void
}

const SavedListContext = createContext<SavedListContextType | null>(null)

/** All profiles' lists, keyed by profile id. */
type SavedStore = Record<number, SavedTitle[]>

export function SavedListProvider({ children }: { children: ReactNode }) {
  const { activeProfileId } = useProfiles()
  const [store, setStore] = usePersistentState<SavedStore>('spiflix-my-list', {})

  const items = useMemo(() => store[activeProfileId] ?? [], [store, activeProfileId])
  const savedSet = useMemo(() => new Set(items.map(i => key(i.id, i.type))), [items])

  const isSaved = useCallback(
    (id: number, type: 'movie' | 'tv') => savedSet.has(key(id, type)),
    [savedSet],
  )

  const toggle = useCallback((title: SavedTitle) => {
    setStore(prev => {
      const list = prev[activeProfileId] ?? []
      const exists = list.some(i => i.id === title.id && i.type === title.type)
      const next = exists
        ? list.filter(i => !(i.id === title.id && i.type === title.type))
        : [{ ...title }, ...list]
      return { ...prev, [activeProfileId]: next }
    })
  }, [setStore, activeProfileId])

  const remove = useCallback((id: number, type: 'movie' | 'tv') => {
    setStore(prev => {
      const list = prev[activeProfileId] ?? []
      return { ...prev, [activeProfileId]: list.filter(i => !(i.id === id && i.type === type)) }
    })
  }, [setStore, activeProfileId])

  const value = useMemo(
    () => ({ items, count: items.length, isSaved, toggle, remove }),
    [items, isSaved, toggle, remove],
  )

  return <SavedListContext.Provider value={value}>{children}</SavedListContext.Provider>
}

export function useSavedList() {
  const ctx = useContext(SavedListContext)
  if (!ctx) throw new Error('useSavedList must be used within SavedListProvider')
  return ctx
}
