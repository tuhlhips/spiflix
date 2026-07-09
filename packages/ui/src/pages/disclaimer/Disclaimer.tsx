import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function Disclaimer() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-2xl py-12 px-4 sm:px-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        {t('disclaimer.goBack')}
      </button>

      <h1 className="text-2xl font-bold mb-6">{t('disclaimer.title')}</h1>

      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>{t('disclaimer.p1')}</p>
        <p>{t('disclaimer.p2')}</p>
        <p>{t('disclaimer.p3')}</p>
        <p>{t('disclaimer.p4')}</p>
        <p>{t('disclaimer.p5')}</p>
      </div>
    </div>
  )
}
