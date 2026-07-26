import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Shuffle, Play, Star, Info } from 'lucide-react'
import { api } from '@/lib/api'
import { getImageUrl } from '@/lib/utils'
import { Segmented } from '@/components/ui/Segmented'
import { useDrawer } from '@/app/providers/drawer-provider'

type MediaType = 'movie' | 'tv'
type Filter = 'any' | 'movie' | 'tv'

interface PoolItem {
  id: number
  type: MediaType
  title: string
  overview: string
  poster_path: string | null
  vote_average: number
  year: string
  genre: string | null
}

const SPIN_TICKS = 14
const SPIN_INTERVAL = 90

/** Pull a broad pool of real titles for the chosen filter, then shuffle through
 * them like a slot machine and settle on one. Data is real TMDB; only the
 * "spin" is theatre. */
export default function Surprise() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { open: openDrawer } = useDrawer()

  const [filter, setFilter] = useState<Filter>('any')
  const [current, setCurrent] = useState<PoolItem | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const poolRef = useRef<PoolItem[]>([])
  const spinTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const filterRef = useRef(filter)
  filterRef.current = filter

  const buildPool = useCallback(async (f: Filter): Promise<PoolItem[]> => {
    const types: MediaType[] = f === 'any' ? ['movie', 'tv'] : [f]
    const chunks = await Promise.all(types.map(async (type) => {
      const [items, genres] = await Promise.all([
        api.tmdb.discover(type, {
          // A shallow-random page keeps the pool popular enough to have artwork
          // while still varying run to run.
          page: Math.floor(Math.random() * 15) + 1,
          sortBy: 'popularity.desc',
          genreId: null,
          yearFrom: '',
          yearTo: '',
        }) as Promise<any[]>,
        api.tmdb.genres(type),
      ])
      const genreName = new Map(genres.map(g => [g.id, g.name]))
      return items
        .filter(it => it.poster_path)
        .map<PoolItem>(it => ({
          id: it.id,
          type,
          title: it.title || it.name || '',
          overview: it.overview || '',
          poster_path: it.poster_path,
          vote_average: it.vote_average || 0,
          year: (it.release_date || it.first_air_date || '').slice(0, 4),
          genre: (it.genre_ids || []).map((id: number) => genreName.get(id)).find(Boolean) ?? null,
        }))
    }))
    const pool = chunks.flat()
    // Warm the browser cache so the rapid-fire shuffle doesn't flash blanks.
    pool.slice(0, 30).forEach(p => { if (p.poster_path) { const img = new Image(); img.src = getImageUrl(p.poster_path, 'w342')! } })
    return pool
  }, [])

  const spin = useCallback(async () => {
    if (spinTimer.current) return
    setError(null)
    try {
      let pool = poolRef.current
      if (pool.length === 0) {
        pool = await buildPool(filterRef.current)
        poolRef.current = pool
      }
      if (pool.length === 0) { setError(t('surprise.errorNone')); return }

      setSpinning(true)
      let n = 0
      spinTimer.current = setInterval(() => {
        n += 1
        const pick = pool[Math.floor(Math.random() * pool.length)]
        setCurrent(pick)
        if (n >= SPIN_TICKS) {
          if (spinTimer.current) clearInterval(spinTimer.current)
          spinTimer.current = null
          setSpinning(false)
        }
      }, SPIN_INTERVAL)
    } catch {
      setError(t('surprise.errorGeneric'))
      setSpinning(false)
    }
  }, [buildPool, t])

  // Rebuild the pool (and clear the current pick) when the filter changes.
  useEffect(() => {
    if (spinTimer.current) { clearInterval(spinTimer.current); spinTimer.current = null }
    poolRef.current = []
    setCurrent(null)
    setSpinning(false)
    let cancelled = false
    buildPool(filter).then(pool => { if (!cancelled) poolRef.current = pool }).catch(() => {})
    return () => { cancelled = true }
  }, [filter, buildPool])

  useEffect(() => () => { if (spinTimer.current) clearInterval(spinTimer.current) }, [])

  const settled = current != null && !spinning
  const play = () => current && navigate(`/watch/${current.type}/${current.id}${current.type === 'tv' ? '?s=1&e=1' : ''}`)

  return (
    <main className="sfx-fade mx-auto max-w-[900px] px-4 pb-20 pt-28 text-center sm:px-8">
      <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.14em] text-primary">{t('surprise.cantDecide')}</p>
      <h1 className="mb-2.5 text-4xl font-extrabold tracking-tight sm:text-5xl">{t('surprise.playSomething')}</h1>
      <p className="mx-auto mb-8 max-w-[440px] text-[15px] leading-relaxed text-muted-foreground">{t('surprise.tagline')}</p>

      <div className="mb-9 flex justify-center">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          aria-label={t('surprise.playSomething')}
          options={[
            { value: 'any', label: t('surprise.anything') },
            { value: 'movie', label: t('surprise.aMovie') },
            { value: 'tv', label: t('surprise.aSeries') },
          ]}
        />
      </div>

      {/* Shuffling card */}
      <div className="mb-8 flex justify-center">
        <div
          className="relative h-[375px] w-[250px] overflow-hidden rounded-2xl bg-muted shadow-[0_30px_70px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-transform duration-150"
          style={{ transform: spinning ? 'rotate(2deg) scale(0.97)' : 'none' }}
        >
          {current ? (
            <>
              {current.poster_path && (
                <img src={getImageUrl(current.poster_path, 'w342')!} alt="" className="absolute inset-0 h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
              <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-bold text-white">
                <Star className="h-3 w-3" style={{ color: 'var(--star)' }} fill="currentColor" />
                {current.vote_average.toFixed(1)}
              </div>
              <div className="absolute inset-x-4 bottom-4 text-left">
                <p className="mb-0.5 text-xl font-extrabold leading-tight text-white">{current.title}</p>
                <p className="text-xs font-semibold text-white/70">
                  {[current.year, current.genre].filter(Boolean).join(' · ')}
                </p>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 rounded-2xl border-2 border-dashed border-[var(--hairline-strong)]">
              <Shuffle className="h-11 w-11 text-muted-foreground/60" />
              <span className="text-sm font-semibold text-muted-foreground/70">{t('surprise.yourPickHere')}</span>
            </div>
          )}
        </div>
      </div>

      {error && <p className="mb-5 text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={spin}
          disabled={spinning}
          className="flex items-center gap-2.5 rounded-full bg-primary px-9 py-3.5 text-base font-bold text-primary-foreground shadow-[var(--shadow-cta)] transition-all hover:scale-[1.03] hover:brightness-110 disabled:opacity-70"
        >
          <Shuffle className={`h-[18px] w-[18px] ${spinning ? 'animate-spin' : ''}`} />
          {current ? t('surprise.spinAgain') : t('surprise.surpriseMe')}
        </button>
        {settled && (
          <>
            <button onClick={play} className="flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-foreground/[0.08] px-7 py-3.5 text-base font-semibold text-foreground transition-colors hover:bg-foreground/[0.16]">
              <Play className="h-4 w-4 fill-current" />
              {t('surprise.play')}
            </button>
            <button onClick={() => current && openDrawer({ id: current.id, type: current.type })} className="flex items-center gap-2 rounded-full border border-[var(--hairline-strong)] bg-foreground/[0.08] px-7 py-3.5 text-base font-semibold text-foreground transition-colors hover:bg-foreground/[0.16]">
              <Info className="h-4 w-4" />
              {t('surprise.moreInfo')}
            </button>
          </>
        )}
      </div>

      {settled && current.overview && (
        <p className="mx-auto mt-7 max-w-[520px] text-sm leading-relaxed text-muted-foreground">{current.overview}</p>
      )}
    </main>
  )
}
