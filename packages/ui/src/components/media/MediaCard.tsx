import { memo } from 'react'
import { Star, Play } from 'lucide-react'
import { getImageUrl } from '@/lib/utils'
import { useDrawer } from '@/app/providers/drawer-provider'
import { StarRating } from '@/components/ui/StarRating'

interface MediaCardProps {
  id: number
  type: 'movie' | 'tv'
  title: string
  posterPath: string | null
  rating: number
  releaseDate?: string
}

export const MediaCard = memo(function MediaCard({ id, type, title, posterPath, rating, releaseDate }: MediaCardProps) {
  const { open } = useDrawer()
  const year = releaseDate?.slice(0, 4)

  return (
    <button
      onClick={() => open({ id, type })}
      className="group relative flex-shrink-0 w-[150px] sm:w-[180px] text-left"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
        {posterPath ? (
          <img
            src={getImageUrl(posterPath)!}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.08]"
          />
        ) : (
          <img
            src="/icon.svg"
            alt={title}
            className="h-full w-full object-cover p-8 opacity-30"
          />
        )}

        {/* Hover gradient overlay with metadata */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
          <p className="text-sm leading-tight font-semibold text-white line-clamp-1">{title}</p>
          <div className="mt-1 flex w-full items-center justify-between text-xs font-medium">
            <StarRating rating={rating} />
            {year && <span className="text-white/70">{year}</span>}
          </div>
        </div>

        {/* Play icon overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Play className="h-4 w-4 fill-current ml-0.5" />
          </div>
        </div>

        {/* Persistent rating badge (kept per user request) */}
        {rating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-xs font-medium backdrop-blur-sm">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            {rating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Title and year below card */}
      <div className="mt-2">
        <p className="text-sm font-medium line-clamp-1">{title}</p>
        {year && <p className="text-xs text-muted-foreground">{year}</p>}
      </div>
    </button>
  )
})
