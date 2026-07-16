import { Navigate, useParams } from 'react-router-dom'
import { MediaPlayer } from '@/components/player/MediaPlayer'

export default function WatchMovie() {
  const { id } = useParams<{ id: string }>()
  const tmdbId = Number(id)
  if (!id || !/^\d+$/.test(id) || !Number.isSafeInteger(tmdbId) || tmdbId <= 0) return <Navigate to="/not-found" replace />

  return <MediaPlayer tmdbId={tmdbId} type="movie" />
}
