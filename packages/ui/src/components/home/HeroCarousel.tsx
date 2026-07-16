import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { api } from '@/lib/api'
import { getImageUrl, cn } from '@/lib/utils'
import { useDrawer } from '@/app/providers/drawer-provider'
import { StarRating } from '@/components/ui/StarRating'

interface HeroSlide {
  id: number
  title: string
  overview: string
  backdropPath: string | null
  posterPath: string | null
  rating: number
  year: string
  genres: string[]
  type: 'movie' | 'tv'
  runtime?: number
}

interface HeroCarouselProps {
  type?: 'movie' | 'tv'
}

export function HeroCarousel({ type }: HeroCarouselProps) {
  const navigate = useNavigate()
  const { open: openDrawer } = useDrawer()
  const [slides, setSlides] = useState<HeroSlide[]>([])
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const [paused, setPaused] = useState(false)
  const progressRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchers = type === 'movie'
      ? [api.tmdb.trending('movie').then(items => items.slice(0, 6).map((i: any) => ({
          id: i.id, title: i.title, overview: i.overview, backdropPath: i.backdrop_path,
          posterPath: i.poster_path, rating: i.vote_average, year: (i.release_date || '').slice(0, 4),
          genres: i.genre_ids || [], type: 'movie' as const,
        })))]
      : type === 'tv'
        ? [api.tmdb.trending('tv').then(items => items.slice(0, 6).map((i: any) => ({
            id: i.id, title: i.name, overview: i.overview, backdropPath: i.backdrop_path,
            posterPath: i.poster_path, rating: i.vote_average, year: (i.first_air_date || '').slice(0, 4),
            genres: i.genre_ids || [], type: 'tv' as const,
          })))]
        : [
            api.tmdb.trending('movie').then(items => items.slice(0, 5).map((i: any) => ({
              id: i.id, title: i.title, overview: i.overview, backdropPath: i.backdrop_path,
              posterPath: i.poster_path, rating: i.vote_average, year: (i.release_date || '').slice(0, 4),
              genres: i.genre_ids || [], type: 'movie' as const,
            }))),
            api.tmdb.trending('tv').then(items => items.slice(0, 3).map((i: any) => ({
              id: i.id, title: i.name, overview: i.overview, backdropPath: i.backdrop_path,
              posterPath: i.poster_path, rating: i.vote_average, year: (i.first_air_date || '').slice(0, 4),
              genres: i.genre_ids || [], type: 'tv' as const,
            }))),
          ]

    Promise.all(fetchers).then(results => {
      const all = results.flat().sort(() => Math.random() - 0.5).slice(0, 6)
      setSlides(all)
      // Keep the index valid if this effect re-runs and returns fewer slides.
      setCurrent(0)
    }).catch(() => {})
  }, [type])

  const next = useCallback(() => {
    setCurrent(p => (p + 1) % slides.length)
  }, [slides.length])

  const prev = useCallback(() => {
    setCurrent(p => (p - 1 + slides.length) % slides.length)
  }, [slides.length])

  useEffect(() => {
    if (slides.length === 0) return
    timerRef.current = setInterval(() => {
      if (!paused) next()
    }, 6500)
    return () => clearInterval(timerRef.current)
  }, [slides.length, paused, next])

  if (slides.length === 0) return null

  const slide = slides[current]

  return (
    <div
      className="group relative h-[80vh] md:h-screen overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((s, i) => (
        <div
          // Movie and TV ids share the same numeric space on TMDB, and the
          // mixed carousel interleaves both — the raw id alone can collide.
          key={`${s.type}-${s.id}`}
          className={cn('pointer-events-none absolute inset-0 transition-opacity duration-700', i === current ? 'opacity-100' : 'opacity-0')}
        >
          {s.backdropPath && (
            <img src={getImageUrl(s.backdropPath, 'original')!} alt="" className="h-full w-full object-cover" />
          )}
        </div>
      ))}

      {/* Gradient overlay matching reference diagonal style */}
      <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(0,0,0,0.92)_10%,rgba(0,0,0,0.45)_45%,rgba(0,0,0,0.82)_100%)]" />

      {/* Content */}
      <div className="relative z-10 flex h-full items-end pb-18 sm:pb-23">
        <div className="mx-auto w-full max-w-7xl px-6 sm:px-8 lg:px-12">
          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-wrap items-center gap-4 text-sm mb-4 sm:text-base">
              <StarRating rating={slide.rating} />
              {slide.year && <span className="text-white/70">{slide.year}</span>}
              <span className="rounded-full bg-muted/30 px-2.5 py-0.5 text-xs font-medium text-white/80 uppercase">
                {slide.type}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-3 line-clamp-2 text-white drop-shadow-2xl">
              {slide.title}
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-white/70 sm:text-base line-clamp-3 mb-6">
              {slide.overview}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate(slide.type === 'movie' ? `/watch/movie/${slide.id}` : `/watch/tv/${slide.id}?s=1&e=1`)}
                className="flex items-center gap-2 rounded-full bg-primary px-7 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:scale-105"
              >
                <Play className="h-4 w-4 fill-current" />
                Watch Now
              </button>
              <button
                onClick={() => openDrawer({ id: slide.id, type: slide.type })}
                className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-white/20 hover:text-white hover:scale-105"
              >
                <Info className="h-4 w-4" />
                More Info
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress dots — centered, with animated progress bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {slides.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)} className="group/dot relative h-2.5 rounded-full transition-all duration-300" style={{ width: i === current ? '40px' : '10px' }}>
            <div className={cn(
              'h-full w-full rounded-full transition-colors duration-300',
              i === current ? 'bg-primary/20' : 'bg-white/30 hover:bg-white/50',
            )}>
              {i === current && (
                <div
                  ref={progressRef}
                  className="h-full w-full rounded-full bg-primary animate-[carousel-progress_6.5s_linear]"
                  style={{ animationPlayState: paused ? 'paused' : 'running' }}
                />
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Navigation arrows — group-hover reveals */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/60"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/60"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  )
}
