import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, Info } from 'lucide-react'
import { api } from '@/lib/api'
import { getImageUrl } from '@/lib/utils'
import { MediaRail } from '@/components/media/MediaRail'
import { useEffect, useState } from 'react'

export default function Home() {
  const [hero, setHero] = useState<any>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.tmdb.trending('movie').then(items => {
      const featured = items[Math.floor(Math.random() * Math.min(5, items.length))]
      setHero(featured)
    }).catch(() => {})
  }, [])

  const trendingMovies = useCallback(() => api.tmdb.trending('movie'), [])
  const trendingTv = useCallback(() => api.tmdb.trending('tv'), [])
  const popularMovies = useCallback(() => api.tmdb.popular('movie'), [])
  const popularTv = useCallback(() => api.tmdb.popular('tv'), [])
  const topRatedMovies = useCallback(() => api.tmdb.topRated('movie'), [])

  return (
    <div>
      {/* Hero */}
      {hero && (
        <div className="relative h-[70vh] sm:h-[80vh] overflow-hidden">
          {hero.backdrop_path && (
            <img
              src={getImageUrl(hero.backdrop_path, 'w1280')!}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-12">
            <div className="max-w-2xl">
              <h1 className="text-3xl sm:text-5xl font-bold mb-3 line-clamp-2">
                {hero.title}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground line-clamp-3 mb-6">
                {hero.overview}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate(`/watch/movie/${hero.id}`)}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Watch Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content rails */}
      <div className="px-0">
        <MediaRail title="Trending Movies" fetcher={trendingMovies} />
        <MediaRail title="Trending TV Shows" fetcher={trendingTv} />
        <MediaRail title="Popular Movies" fetcher={popularMovies} />
        <MediaRail title="Popular TV Shows" fetcher={popularTv} />
        <MediaRail title="Top Rated" fetcher={topRatedMovies} />
      </div>
    </div>
  )
}
