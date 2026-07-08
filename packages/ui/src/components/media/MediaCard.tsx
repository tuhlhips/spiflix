import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, Play } from 'lucide-react'
import { getImageUrl, cn } from '@/lib/utils'

interface MediaCardProps {
  id: number
  type: 'movie' | 'tv'
  title: string
  posterPath: string | null
  rating: number
  releaseDate?: string
}

export const MediaCard = memo(function MediaCard({ id, type, title, posterPath, rating, releaseDate }: MediaCardProps) {
  const navigate = useNavigate()
  const year = releaseDate?.slice(0, 4)

  const handleClick = () => {
    if (type === 'movie') {
      navigate(`/watch/movie/${id}`)
    } else {
      navigate(`/watch/tv/${id}?s=1&e=1`)
    }
  }

  return (
    <button
      onClick={handleClick}
      className="group relative flex-shrink-0 w-[150px] sm:w-[180px] text-left"
    >
      {/* Poster */}
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
        {posterPath ? (
          <img
            src={getImageUrl(posterPath)!}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Play className="h-4 w-4 fill-current" />
          </div>
        </div>

        {/* Rating badge */}
        {rating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium backdrop-blur-sm">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            {rating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="mt-2">
        <p className="text-sm font-medium line-clamp-1">{title}</p>
        {year && <p className="text-xs text-muted-foreground">{year}</p>}
      </div>
    </button>
  )
})
