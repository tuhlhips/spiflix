import { Film } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background/50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Film className="h-4 w-4" />
            <span>Spiflix</span>
          </Link>
          <p className="text-xs text-muted-foreground/60">
            Built with React, Vite, and Fastify
          </p>
        </div>
      </div>
    </footer>
  )
}
