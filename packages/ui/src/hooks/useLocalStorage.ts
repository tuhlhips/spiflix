import { useState, useEffect } from 'react'

/**
 * Persistent state hook — reads/writes to localStorage.
 * Handles JSON parse errors and quota exceeded silently.
 */
function read<T>(key: string, initialValue: T): T {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : initialValue
  } catch {
    return initialValue
  }
}

export function usePersistentState<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => read(key, initialValue))

  // When the caller switches keys (e.g. playback progress keyed per episode,
  // with the component staying mounted across episode changes), re-read the
  // new key's value instead of carrying the previous key's state over — the
  // write effect below would otherwise persist the OLD key's state under the
  // NEW key. This render-time adjustment runs before that effect can fire.
  const [trackedKey, setTrackedKey] = useState(key)
  if (key !== trackedKey) {
    setTrackedKey(key)
    setState(read(key, initialValue))
  }

  useEffect(() => {
    try {
      // null/undefined mean "no value" — remove the key instead of persisting
      // the string "null" (which previously polluted localStorage with an
      // entry for every title merely opened, and made clear() store garbage).
      if (state === null || state === undefined) {
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, JSON.stringify(state))
      }
    } catch {
      // Quota exceeded or private browsing — silently ignore
    }
  }, [key, state])

  return [state, setState]
}
