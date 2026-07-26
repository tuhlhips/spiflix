import { memo } from 'react'
import { Film } from 'lucide-react'
import { getImageUrl, cn } from '@/lib/utils'
import { useDrawer } from '@/app/providers/drawer-provider'
import { useSavedList } from '@/app/providers/saved-list-provider'
import { RatingBadge } from '@/components/ui/RatingBadge'

interface MediaCardProps {
  id: number
  type: 'movie' | 'tv'
  title: string
  posterPath: string | null
  rating: number
  releaseDate?: string
  /** Small corner pill, e.g. a season count for TV. */
  badge?: string
  /**
   * 'rail' scales on hover (horizontal carousels); 'grid' lifts on hover
   * (responsive grids). Matches the design handoff's two card treatments.
   */
  variant?: 'rail' | 'grid'
}

export const MediaCard = memo(function MediaCard({
  id, type, title, posterPath, rating, releaseDate, badge, variant = 'rail',
}: MediaCardProps) {
  const { open } = useDrawer()
  const { isSaved } = useSavedList()
  const year = releaseDate?.slice(0, 4)
  const saved = isSaved(id, type)

  return (
    <button
      onClick={() => open({ id, type })}
      className={cn('group relative w-full text-left', variant === 'grid' ? 'block' : 'flex-shrink-0')}
    >
      <div
        className={cn(
          'relative aspect-[2/3] overflow-hidden rounded-[10px] bg-muted',
          'shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)]',
          'transition-[transform,box-shadow] duration-[280ms] ease-[cubic-bezier(0.2,0.7,0.2,1)]',
          variant === 'grid'
            ? 'group-hover:-translate-y-1.5 group-hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14),0_22px_40px_rgba(0,0,0,0.55)]'
            : 'group-hover:scale-[1.06] group-hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14),0_22px_44px_rgba(0,0,0,0.6)]',
        )}
      >
        {posterPath ? (
          <img
            src={getImageUrl(posterPath, 'w342')!}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-background p-4 text-center">
            <Film className="h-6 w-6 text-muted-foreground/50" />
            <span className="line-clamp-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
          </div>
        )}

        {/* Rating badge — top-right */}
        <RatingBadge rating={rating} className="absolute right-2 top-2" />

        {/* Saved (My List) check — top-left, accent */}
        {saved && (
          <div className="absolute left-2 top-2 flex h-[22px] w-[22px] items-center justify-center rounded-md bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
        )}

        {/* Optional corner pill (e.g. season count) — bottom-left */}
        {badge && (
          <span className="absolute bottom-2 left-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            {badge}
          </span>
        )}
      </div>

      <div className="mt-2">
        <p className="truncate text-[13px] font-semibold text-foreground/90">{title}</p>
        {year && <p className="mt-0.5 text-xs text-muted-foreground">{year}</p>}
      </div>
    </button>
  )
})
