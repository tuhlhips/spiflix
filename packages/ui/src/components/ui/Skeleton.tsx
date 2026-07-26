import { cn } from '@/lib/utils'

/**
 * Loading placeholder. Pulses unless reduce-motion is on (the global
 * kill-switch in index.css dampens the animation). Compose with width/height/
 * radius utilities: `<Skeleton className="aspect-[2/3] rounded-lg" />`.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-muted', className)} />
}
