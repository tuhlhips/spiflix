import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RatingBadgeProps {
  rating: number
  className?: string
}

/**
 * The IMDb-style "★ 8.6" pill shown on poster corners. Uses the handoff's
 * star color (--star). Renders nothing for unrated titles (rating <= 0).
 */
export function RatingBadge({ rating, className }: RatingBadgeProps) {
  if (!rating || rating <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-semibold text-white backdrop-blur-sm tabular-nums',
        className,
      )}
    >
      <Star className="h-3 w-3" style={{ fill: 'var(--star)', color: 'var(--star)' }} />
      {rating.toFixed(1)}
    </span>
  )
}
