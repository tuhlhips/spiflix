import { createContext, useContext, useCallback, useMemo, type ReactNode } from 'react'
import { usePersistentState } from '@/hooks/useLocalStorage'

export interface Profile {
  id: number
  name: string
  /** Single-letter avatar glyph. */
  initial: string
  /** Two-stop gradient for the avatar tile. */
  colors: [string, string]
  kid?: boolean
}

/** Seed profiles, matching the design handoff ("Who's watching?"). */
const DEFAULT_PROFILES: Profile[] = [
  { id: 1, name: 'Sam', initial: 'S', colors: ['#e94a5a', '#7a1230'] },
  { id: 2, name: 'Priya', initial: 'P', colors: ['#4a7bf7', '#122a7a'] },
  { id: 3, name: 'Leo', initial: 'L', colors: ['#12b981', '#0a5236'] },
  { id: 4, name: 'Kids', initial: 'K', colors: ['#eda000', '#7a4e00'], kid: true },
]

/** The avatar tile background for a profile. */
export function profileGradient(p: Profile): string {
  return `linear-gradient(150deg, ${p.colors[0]}, ${p.colors[1]})`
}

interface ProfilesContextType {
  profiles: Profile[]
  activeProfileId: number
  activeProfile: Profile
  setActiveProfile: (id: number) => void
  addProfile: (input: Omit<Profile, 'id'>) => void
  updateProfile: (id: number, patch: Partial<Omit<Profile, 'id'>>) => void
  removeProfile: (id: number) => void
}

const ProfilesContext = createContext<ProfilesContextType | null>(null)

export function ProfilesProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = usePersistentState<Profile[]>('spiflix-profiles', DEFAULT_PROFILES)
  const [activeProfileId, setActiveProfileId] = usePersistentState<number>('spiflix-active-profile', DEFAULT_PROFILES[0].id)

  // Never leave the app pointing at a deleted/absent profile.
  const activeProfile = useMemo(
    () => profiles.find(p => p.id === activeProfileId) ?? profiles[0] ?? DEFAULT_PROFILES[0],
    [profiles, activeProfileId],
  )

  const setActiveProfile = useCallback((id: number) => setActiveProfileId(id), [setActiveProfileId])

  const addProfile = useCallback((input: Omit<Profile, 'id'>) => {
    setProfiles(prev => {
      const id = prev.reduce((max, p) => Math.max(max, p.id), 0) + 1
      return [...prev, { ...input, id }]
    })
  }, [setProfiles])

  const updateProfile = useCallback((id: number, patch: Partial<Omit<Profile, 'id'>>) => {
    setProfiles(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)))
  }, [setProfiles])

  const removeProfile = useCallback((id: number) => {
    setProfiles(prev => (prev.length <= 1 ? prev : prev.filter(p => p.id !== id)))
  }, [setProfiles])

  const value = useMemo(
    () => ({ profiles, activeProfileId: activeProfile.id, activeProfile, setActiveProfile, addProfile, updateProfile, removeProfile }),
    [profiles, activeProfile, setActiveProfile, addProfile, updateProfile, removeProfile],
  )

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>
}

export function useProfiles() {
  const ctx = useContext(ProfilesContext)
  if (!ctx) throw new Error('useProfiles must be used within ProfilesProvider')
  return ctx
}
