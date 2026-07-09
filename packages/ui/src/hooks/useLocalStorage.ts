import { useState, useEffect } from 'react'

/**
 * Persistent state hook — reads/writes to localStorage.
 * Handles JSON parse errors and quota exceeded silently.
 */
export function usePersistentState<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // Quota exceeded or private browsing — silently ignore
    }
  }, [key, state])

  return [state, setState]
}
