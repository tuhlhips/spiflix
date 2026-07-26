import { useMemo } from 'react'
import { useHistory } from '@/app/providers/history-provider'

export interface ContinueWatchingItem {
  id: number
  type: 'movie' | 'tv'
  title: string
  posterPath: string | null
  season?: number
  episode?: number
  /** 0–100 watched. */
  pct: number
  /** Seconds left to watch. */
  remaining: number
  /** Route to resume playback at the right movie/episode. */
  resumePath: string
}

/** Below this we treat a title as "finished" and drop it from the rail. */
const FINISHED_AT = 0.95

/**
 * Derives the "Continue Watching" rail from the watch-history store: titles the
 * viewer started but hasn't finished, most-recently-watched first. No fetching
 * — history already carries title/poster/position.
 */
export function useContinueWatching(limit = 20): ContinueWatchingItem[] {
  const { items } = useHistory()
  return useMemo(() => {
    return items
      .filter(i => i.duration > 0 && i.currentTime > 5 && i.currentTime / i.duration < FINISHED_AT)
      .sort((a, b) => b.updated - a.updated)
      .slice(0, limit)
      .map(i => ({
        id: i.id,
        type: i.type,
        title: i.title,
        posterPath: i.posterPath ?? null,
        season: i.season,
        episode: i.episode,
        pct: Math.round((i.currentTime / i.duration) * 100),
        remaining: Math.max(0, Math.round(i.duration - i.currentTime)),
        resumePath: i.type === 'movie'
          ? `/watch/movie/${i.id}`
          : `/watch/tv/${i.id}?s=${i.season ?? 1}&e=${i.episode ?? 1}`,
      }))
  }, [items, limit])
}
