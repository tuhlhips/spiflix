import { usePersistentState } from './useLocalStorage'

interface PlaybackProgress {
  currentTime: number
  duration: number
  timestamp: number
}

function readProgress(key: string): number | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const p = JSON.parse(raw) as PlaybackProgress
    if (!p || !p.currentTime || !p.timestamp) return null
    if (Date.now() - p.timestamp > 7 * 24 * 60 * 60 * 1000) return null
    if (p.duration > 0 && p.currentTime / p.duration > 0.95) return null
    return p.currentTime
  } catch {
    return null
  }
}

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
    if (currentTime < 5 || duration - currentTime < 5) return
    console.log('[Playback] save key:', key, 'time:', currentTime, 'duration:', duration)
    setProgress({ currentTime, duration, timestamp: Date.now() })
  }

  const clear = () => setProgress(null)

  const getResumeTime = (): number | null => {
    const saved = readProgress(key)
    console.log('[Playback] getResumeTime key:', key, 'result:', saved)
    return saved
  }

  return { save, clear, getResumeTime, hasProgress: progress !== null }
}
