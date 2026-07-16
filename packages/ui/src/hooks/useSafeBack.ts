import { useCallback } from 'react'
import { useNavigate, type To } from 'react-router-dom'

interface RouterHistoryState {
  idx?: unknown
}

/**
 * Return to the previous in-app location, or use a safe route when the page
 * was opened directly (or has no router history entry to return to).
 */
export function useSafeBack(fallback: To) {
  const navigate = useNavigate()

  return useCallback(() => {
    const state = window.history.state as RouterHistoryState | null
    if (typeof state?.idx === 'number' && state.idx > 0) {
      navigate(-1)
      return
    }

    // Replacing avoids creating a Back loop from a direct/deep-linked page.
    navigate(fallback, { replace: true })
  }, [fallback, navigate])
}
