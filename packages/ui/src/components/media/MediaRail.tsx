import { useEffect, useState, useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MediaCard } from './MediaCard'
import { cn } from '@/lib/utils'

interface MediaRailProps {
  title: string
  fetcher: () => Promise<any[]>
  mapper?: (item: any) => {
    id: number
    type: 'movie' | 'tv'
    title: string
    posterPath: string | null
    rating: number
    releaseDate?: string
  }
}

const defaultMapper = (item: any) => ({
  id: item.id,
  type: (item.media_type || 'movie') as 'movie' | 'tv',
  title: item.title || item.name || 'Untitled',
  posterPath: item.poster_path,
  rating: item.vote_average || 0,
  releaseDate: item.release_date || item.first_air_date,
})

export function MediaRail({ title, fetcher, mapper = defaultMapper }: MediaRailProps) {
  const [items, setItems] = useState<any[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetcher().then(setItems).catch(() => {})
  }, [fetcher])

  if (items.length === 0) return null

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return
    const amount = scrollRef.current.clientWidth * 0.75
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }

  return (
    <section className="py-4">
      <div className="flex items-center justify-between px-4 sm:px-6 mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex gap-1">
          <button
            onClick={() => scroll('left')}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth px-4 sm:px-6 pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`.media-rail-scroll::-webkit-scrollbar { display: none; }`}</style>
        {items.map((item) => {
          const mapped = mapper(item)
          return (
            <MediaCard
              key={mapped.id}
              id={mapped.id}
              type={mapped.type}
              title={mapped.title}
              posterPath={mapped.posterPath}
              rating={mapped.rating}
              releaseDate={mapped.releaseDate}
            />
          )
        })}
      </div>
    </section>
  )
}
