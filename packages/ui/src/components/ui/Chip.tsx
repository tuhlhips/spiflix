import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ChipProps {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}

/**
 * Chip — the horizontally-scrolling filter pill used for genres and search
 * facets. Active chips fill with the accent; the rest are quiet outlines.
 */
export function Chip({ active = false, onClick, children, className }: ChipProps) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  )
}
