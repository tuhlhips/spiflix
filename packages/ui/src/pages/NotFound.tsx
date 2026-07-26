import { Link } from 'react-router-dom'
import { Home } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <h1 className="text-6xl font-bold text-muted-foreground/30 mb-4">{t('notFound.code')}</h1>
      <p className="text-lg text-muted-foreground mb-6">{t('notFound.message')}</p>
      <Link
        to="/"
        className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Home className="h-4 w-4" />
        {t('notFound.home')}
      </Link>
    </div>
  )
}
