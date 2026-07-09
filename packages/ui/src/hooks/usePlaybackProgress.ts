import { usePersistentState } from './useLocalStorage'

interface PlaybackProgress {
  currentTime: number
  duration: number
  timestamp: number
}

/**
 * Playback progress persistence — saves/resumes video position.
 * Key format: `playback_{type}_{tmdbId}_{season}_{episode}`
 */
export function usePlaybackProgress(
  type: 'movie' | 'tv',
  tmdbId: number,
  season?: number,
  episode?: number,
) {
  const key = type === 'tv'
    ? `playback_tv_${tmdbId}_s${season}_e${episode}`
    : `playback_movie_${tmdbId}`

  const [progress, setProgress] = usePersistentState<PlaybackProgress | null>(key, null)

  const save = (currentTime: number, duration: number) => {
    // Don't save if less than 5 seconds in or at the end
    if (currentTime < 5 || duration - currentTime < 5) return
    setProgress({ currentTime, duration, timestamp: Date.now() })
  }

  const clear = () => setProgress(null)

  const getResumeTime = (): number | null => {
    if (!progress) return null
    // Don't resume if saved more than 7 days ago
    if (Date.now() - progress.timestamp > 7 * 24 * 60 * 60 * 1000) return null
    // Don't resume if near the end (>95%)
    if (progress.duration > 0 && progress.currentTime / progress.duration > 0.95) return null
    return progress.currentTime
  }

  return { save, clear, getResumeTime, hasProgress: progress !== null }
}
