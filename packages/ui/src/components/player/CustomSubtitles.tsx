import { useEffect, useRef } from 'react'
import { parseVTT } from '@/lib/subtitles'
import { useSubtitleSettings } from '@/hooks/useSubtitleSettings'

interface CustomSubtitlesProps {
  url: string
  videoRef: React.RefObject<HTMLVideoElement | null>
}

export function CustomSubtitles({ url, videoRef }: CustomSubtitlesProps) {
  const trackRef = useRef<TextTrack | null>(null)
  const [settings] = useSubtitleSettings()

  useEffect(() => {
    const video = videoRef.current
    if (!video || !url) return

    let cancelled = false

    async function load() {
      try {
        const res = await fetch(url)
        const text = await res.text()
        if (cancelled) return

        let vttText = text

        if (text.startsWith('#EXTM3U')) {
          const match = text.match(/^https?:\/\/.+\.vtt[^\s]*/m)
          if (match) {
            try {
              const vttRes = await fetch(match[0])
              vttText = await vttRes.text()
            } catch { return }
          } else { return }
        }

        if (cancelled) return
        const cues = parseVTT(vttText)
        if (cues.length === 0) return

        const track = video!.addTextTrack('subtitles', 'English', 'en')
        track.mode = 'showing'
        trackRef.current = track

        for (const cue of cues) {
          try {
            const vttCue = new VTTCue(cue.start, cue.end, cue.text)
            track.addCue(vttCue)
          } catch {}
        }
      } catch {}
    }

    if (trackRef.current) {
      trackRef.current.mode = 'disabled'
      trackRef.current = null
    }

    load()
    return () => {
      cancelled = true
      if (trackRef.current) {
        trackRef.current.mode = 'disabled'
        trackRef.current = null
      }
    }
  }, [url, videoRef])

  // Apply subtitle styling via CSS custom properties on the video element
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // VTTCue styling is limited, so we use CSS to style the video pseudo-element
    const styleId = 'spiflix-subtitle-styles'
    let style = document.getElementById(styleId) as HTMLStyleElement
    if (!style) {
      style = document.createElement('style')
      style.id = styleId
      document.head.appendChild(style)
    }

    const bgMap: Record<string, string> = { none: '0', low: '0.3', medium: '0.6', high: '0.85' }
    const sizeMap: Record<string, string> = { sm: '14px', md: '18px', lg: '24px', xl: '32px' }

    style.textContent = `
      video::cue {
        font-size: ${sizeMap[settings.fontSize]};
        color: ${settings.color};
        background-color: rgba(0,0,0,${bgMap[settings.bgOpacity]});
        font-family: system-ui, -apple-system, sans-serif;
      }
    `
  }, [settings, videoRef])

  return null
}
