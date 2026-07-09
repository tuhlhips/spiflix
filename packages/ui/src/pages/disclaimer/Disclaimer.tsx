import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function Disclaimer() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-2xl py-12 px-4 sm:px-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" />
        Go back
      </button>

      <h1 className="text-2xl font-bold mb-6">Disclaimer</h1>

      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Spiflix does not host any copyrighted content on its servers. All media content
          displayed on this website is sourced from third-party services and embedded via
          publicly available streaming links.
        </p>

        <p>
          This website is intended for educational and personal use only. We do not
          encourage or condone the piracy or unauthorized distribution of copyrighted
          material.
        </p>

        <p>
          All trademarks, logos, and brand names are the property of their respective
          owners. Use of these names does not imply endorsement or affiliation.
        </p>

        <p>
          If you believe that any content available through this website infringes upon
          your copyright, please contact the respective content host directly.
        </p>

        <p>
          This service is provided "as is" without any warranty of any kind, express or
          implied. The operators of this site shall not be held liable for any damages
          arising from the use of this service.
        </p>
      </div>
    </div>
  )
}
