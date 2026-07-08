import { useParams, useSearchParams } from 'react-router-dom'
import { MediaPlayer } from '@/components/player/MediaPlayer'

export default function WatchTv() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const season = Number(searchParams.get('s')) || 1
  const episode = Number(searchParams.get('e')) || 1

  return <MediaPlayer tmdbId={Number(id)} type="tv" season={season} episode={episode} />
}
