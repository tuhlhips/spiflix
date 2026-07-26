import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'
import { useContinueWatching } from '@/hooks/useContinueWatching'
import { getImageUrl } from '@/lib/utils'

function remainingLabel(seconds: number): string {
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min left`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m left` : `${h}h left`
}

/**
 * "Continue Watching" — landscape cards derived from watch history, with a
 * resume-progress bar. Renders nothing when there's nothing in progress.
 */
export function ContinueWatchingRail() {
  const items = useContinueWatching()
  const navigate = useNavigate()
  const { t } = useTranslation()
  if (items.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="px-4 text-2xl font-semibold sm:px-6">{t('home.continueWatching')}</h2>
      <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2 sm:px-6">
        {items.map(item => {
          const poster = getImageUrl(item.posterPath, 'w500')
          const epLabel = item.type === 'tv' && item.season != null && item.episode != null
            ? `S${item.season}:E${item.episode} · `
            : ''
          return (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => navigate(item.resumePath)}
              className="group relative w-[280px] shrink-0 overflow-hidden rounded-xl bg-muted text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
            >
              <div className="relative aspect-video overflow-hidden">
                {poster ? (
                  <img src={poster} alt={item.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-muted to-background" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                {/* Resume affordance */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                    <Play className="ml-0.5 h-5 w-5 fill-current" />
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="truncate text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-0.5 text-xs text-white/70">{epLabel}{remainingLabel(item.remaining)}</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-1 w-full bg-white/15">
                <div className="h-full bg-primary" style={{ width: `${item.pct}%` }} />
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}
