import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StarRatingProps {
  rating: number
  className?: string
  maxStars?: number
}

export function StarRating({ rating, className, maxStars = 5 }: StarRatingProps) {
  const normalized = (rating / 10) * maxStars
  const full = Math.floor(normalized)
  const hasHalf = normalized - full >= 0.25
  const empty = maxStars - full - (hasHalf ? 1 : 0)

  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {Array.from({ length: full }).map((_, i) => (
        <Star key={`full-${i}`} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
      ))}
      {hasHalf && (
        <span className="relative">
          <Star className="h-3.5 w-3.5 text-yellow-400" />
          <span className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          </span>
        </span>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`empty-${i}`} className="h-3.5 w-3.5 text-yellow-400" />
      ))}
      <span className="ml-1 text-xs font-medium">{rating.toFixed(1)}</span>
    </span>
  )
}
