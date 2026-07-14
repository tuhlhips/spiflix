import { useEffect, useRef } from 'react'
import { parseVTT } from '@/lib/subtitles'
import { useSubtitleSettings, type SubtitleSettings } from '@/hooks/useSubtitleSettings'

interface CustomSubtitlesProps {
  url: string
  videoRef: React.RefObject<HTMLVideoElement | null>
}

/**
 * Position a cue per the user's subtitle-position setting. VTTCue has no
 * CSS-based positioning (::cue can't move the box), so "top" vs "bottom"
 * has to be applied per-cue via `line`/`snapToLines`.
 */
function applyCuePosition(cue: VTTCue, position: SubtitleSettings['position']) {
  if (position === 'top') {
    cue.snapToLines = false
    cue.line = 10
  } else {
    cue.snapToLines = true
    cue.line = 'auto'
  }
}

export function CustomSubtitles({ url, videoRef }: CustomSubtitlesProps) {
  const trackRef = useRef<TextTrack | null>(null)
  const [settings] = useSubtitleSettings()
  // Read inside the load effect without making it re-fetch the VTT file
  // whenever settings change.
  const positionRef = useRef(settings.position)
  useEffect(() => {
    positionRef.current = settings.position
  }, [settings.position])

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
            applyCuePosition(vttCue, positionRef.current)
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

  // Re-apply position to the currently loaded cues when the setting changes
  // (no need to re-fetch/re-parse the VTT file for this).
  useEffect(() => {
    const cues = trackRef.current?.cues
    if (!cues) return
    for (let i = 0; i < cues.length; i++) {
      const cue = cues[i]
      if (cue instanceof VTTCue) applyCuePosition(cue, settings.position)
    }
  }, [settings.position])

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
