import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface TrailerDialogProps {
  videoKey: string
  open: boolean
  onClose: () => void
}

export function TrailerDialog({ videoKey, open, onClose }: TrailerDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), iframe, [href], input, select, [tabindex]:not([tabindex="-1"])')
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      returnFocusRef.current?.focus()
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Trailer"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div className="relative w-full max-w-3xl mx-4 aspect-video" onClick={e => e.stopPropagation()}>
        <button
          ref={closeRef}
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors"
          aria-label="Close trailer"
        >
          <X className="h-6 w-6" />
        </button>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoKey}?autoplay=1&modestbranding=1&rel=0`}
          className="h-full w-full rounded-lg"
          allow="autoplay; encrypted-media"
          allowFullScreen
        />
      </div>
    </div>
  )
}
