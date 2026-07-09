import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { getImageUrl } from '@/lib/utils'

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
  const [slides, setSlides] = useState<HeroSlide[]>([])
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)
  const [paused, setPaused] = useState(false)

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
      className="relative h-[75vh] sm:h-[85vh] overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((s, i) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-700 ${i === current ? 'opacity-100' : 'opacity-0'}`}
        >
          {s.backdropPath && (
            <img
              src={getImageUrl(s.backdropPath, 'original')!}
              alt=""
              className="h-full w-full object-cover"
            />
          )}
        </div>
      ))}

      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/60 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-12">
        <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1 rounded-full bg-primary/20 px-2.5 py-1 text-xs font-medium text-primary">
              <Star className="h-3.5 w-3.5 fill-current" />
              {slide.rating.toFixed(1)}
            </div>
            {slide.year && (
              <span className="text-xs text-muted-foreground">{slide.year}</span>
            )}
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs uppercase">
              {slide.type}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold mb-3 line-clamp-2">
            {slide.title}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground line-clamp-3 mb-6 max-w-xl">
            {slide.overview}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(slide.type === 'movie' ? `/watch/movie/${slide.id}` : `/watch/tv/${slide.id}?s=1&e=1`)}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:scale-105"
            >
              <Play className="h-4 w-4 fill-current" />
              Watch Now
            </button>
          </div>
        </div>
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-4 right-4 sm:right-12 flex gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'w-8 bg-primary' : 'w-1.5 bg-white/40 hover:bg-white/60'}`}
          />
        ))}
      </div>

      {/* Navigation arrows */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100"
        style={{ opacity: 0 }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60"
        style={{ opacity: 0 }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  )
}
