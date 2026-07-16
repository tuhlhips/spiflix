import { useEffect, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { MediaPlayer } from '@/components/player/MediaPlayer'
import { EpisodeSidebar } from '@/components/player/EpisodeSidebar'

interface Season {
  id: number
  name: string
  season_number: number
  episode_count: number
}

export default function WatchTv() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const parsePositive = (value: string | null, fallback: number, max: number) => {
    if (value === null) return fallback
    return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0 && Number(value) <= max ? Number(value) : null
  }
  const tmdbId = Number(id)
  const season = parsePositive(searchParams.get('s'), 1, 999)
  const episode = parsePositive(searchParams.get('e'), 1, 10_000)
  const validRoute = Boolean(id && /^\d+$/.test(id) && Number.isSafeInteger(tmdbId) && tmdbId > 0 && season !== null && episode !== null)
  const [showEpisodes, setShowEpisodes] = useState(false)
  const [seasons, setSeasons] = useState<Season[]>([])

  useEffect(() => {
    if (!validRoute) return
    api.tmdb.details('tv', tmdbId)
      .then(data => setSeasons(data.seasons || []))
      .catch(() => {})
  }, [tmdbId, validRoute])

  if (!validRoute || season === null || episode === null) return <Navigate to="/not-found" replace />

  return (
    <div className="relative h-screen w-full bg-black">
      <MediaPlayer
        tmdbId={tmdbId}
        type="tv"
        season={season}
        episode={episode}
        onToggleEpisodes={() => setShowEpisodes(p => !p)}
      />

      {showEpisodes && (
        <EpisodeSidebar
          tmdbId={tmdbId}
          currentSeason={season}
          currentEpisode={episode}
          seasons={seasons}
          onClose={() => setShowEpisodes(false)}
        />
      )}
    </div>
  )
}
