import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'

/** Curated hue spread from the design handoff's genre tiles. */
const TILE_HUES = [15, 215, 95, 250, 45, 150]

function tileGradient(hue: number): string {
  return `linear-gradient(112deg, hsl(${hue} 42% 20%) 0%, hsl(${(hue + 20) % 360} 46% 8%) 55%, var(--color-background) 100%)`
}

/**
 * Genre quick-tiles that overlap the spotlight hero (design: margin-top -30px)
 * and route into Discover pre-filtered by genre. Genres are pulled live from
 * TMDB for the given type, so the passed name always resolves there.
 */
export function GenreTiles({ type }: { type: 'movie' | 'tv' }) {
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([])

  useEffect(() => {
    let cancelled = false
    api.tmdb.genres(type)
      .then(g => { if (!cancelled) setGenres(g.slice(0, 6)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [type])

  if (genres.length === 0) return null

  return (
    <div className="relative z-10 -mt-8 mb-10 grid grid-cols-[repeat(auto-fit,minmax(min(140px,100%),1fr))] gap-3.5 px-4 sm:px-6">
      {genres.map((g, i) => (
        <Link
          key={g.id}
          to={`/discover?type=${type}&genre=${encodeURIComponent(g.name)}`}
          className="relative flex h-[74px] items-center overflow-hidden rounded-2xl px-[18px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)] transition-[filter] hover:brightness-110"
          style={{ background: tileGradient(TILE_HUES[i % TILE_HUES.length]) }}
        >
          <span className="text-base font-bold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.5)]">{g.name}</span>
        </Link>
      ))}
    </div>
  )
}
