import { useParams } from 'react-router-dom'
import { MediaPlayer } from '@/components/player/MediaPlayer'

export default function WatchMovie() {
  const { id } = useParams<{ id: string }>()

  return <MediaPlayer tmdbId={Number(id)} type="movie" />
}
