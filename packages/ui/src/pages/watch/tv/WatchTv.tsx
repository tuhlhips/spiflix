import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
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
  const season = Number(searchParams.get('s')) || 1
  const episode = Number(searchParams.get('e')) || 1
  const [showEpisodes, setShowEpisodes] = useState(false)
  const [seasons, setSeasons] = useState<Season[]>([])

  useEffect(() => {
    api.tmdb.details('tv', Number(id))
      .then(data => setSeasons(data.seasons || []))
      .catch(() => {})
  }, [id])

  return (
    <div className="relative h-screen w-full bg-black">
      <MediaPlayer
        tmdbId={Number(id)}
        type="tv"
        season={season}
        episode={episode}
        onToggleEpisodes={() => setShowEpisodes(p => !p)}
      />

      {showEpisodes && (
        <EpisodeSidebar
          tmdbId={Number(id)}
          currentSeason={season}
          currentEpisode={episode}
          seasons={seasons}
          onClose={() => setShowEpisodes(false)}
        />
      )}
    </div>
  )
}
