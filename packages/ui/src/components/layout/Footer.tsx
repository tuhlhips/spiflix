import { useTranslation } from 'react-i18next'
import { Film } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="border-t border-border/50 bg-background/50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <Link to="/" className="flex items-center gap-2 text-sm font-medium mb-3">
              <Film className="h-4 w-4" />
              <span>{t('app.name')}</span>
            </Link>
            <p className="text-xs text-muted-foreground/60">{t('footer.streamMovies')}</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t('footer.pages')}</h3>
            <ul className="space-y-2">
              <li><Link to="/movies" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t('nav.movies')}</Link></li>
              <li><Link to="/shows" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t('nav.shows')}</Link></li>
              <li><Link to="/discover" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t('nav.discover')}</Link></li>
              <li><Link to="/disclaimer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">{t('footer.disclaimer')}</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t('footer.links')}</h3>
            <ul className="space-y-2">
              <li><a href="https://github.com/tuhlhips/spiflix" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">GitHub</a></li>
              <li><a href="https://github.com/tuhlhips/spiflix/issues" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Report Issue</a></li>
              <li><a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">TMDB</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border/40 text-center">
          <p className="text-xs text-muted-foreground/40">&copy; {new Date().getFullYear()} {t('app.name')}. {t('footer.copyright')}</p>
        </div>
      </div>
    </footer>
  )
}
