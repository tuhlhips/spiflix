import { useEffect, useRef } from 'react'
import { parseVTT, parseVTTTime } from '@/lib/subtitles'
import { useSubtitleSettings, type SubtitleSettings } from '@/hooks/useSubtitleSettings'

interface CustomSubtitlesProps {
  url: string
  videoRef: React.RefObject<HTMLVideoElement | null>
}

/**
 * Segmented playlists carry cue times relative to each segment, anchored by an
 * X-TIMESTAMP-MAP header (MPEGTS 90kHz ticks ↔ local cue time). Only applied
 * for multi-segment playlists — single-segment VOD files (VixSrc) use absolute
 * cue times and must not be shifted.
 */
function segmentTimestampOffset(text: string): number {
  const header = text.match(/X-TIMESTAMP-MAP=([^\r\n]+)/)?.[1]
  if (!header) return 0
  const mpegts = header.match(/MPEGTS:(\d+)/)?.[1]
  const local = header.match(/LOCAL:([\d:.]+)/)?.[1]
  if (!mpegts || !local) return 0
  const offset = Number(mpegts) / 90000 - parseVTTTime(local)
  return Number.isFinite(offset) ? offset : 0
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

        let cues: { start: number; end: number; text: string }[]

        if (text.startsWith('#EXTM3U')) {
          // Subtitle playlists list the VTT as one or more "segments". Segment
          // URLs may be absolute (https://…​.vtt) or already rewritten to our
          // proxy (/v1/proxy?data=…, where the real ".vtt" is hidden inside a
          // base64 blob), so every non-comment line is resolved against the
          // playlist URL. VixSrc uses a single segment for a whole movie, but
          // segmented tracks (common for TV) split the VTT into many chunks —
          // fetching only the first would drop everything after it.
          const segments = text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
          if (segments.length === 0) return
          // Modest batching so a 200-segment episode doesn't fire 200
          // parallel requests at the proxy. Each segment is fetched
          // independently and tolerated: a single failed/empty chunk is
          // skipped, not fatal — otherwise one bad request in the middle of
          // an episode would drop every caption.
          const texts: string[] = []
          const BATCH = 8
          for (let i = 0; i < segments.length && !cancelled; i += BATCH) {
            const batch = await Promise.allSettled(
              segments.slice(i, i + BATCH).map(async seg => {
                const r = await fetch(new URL(seg, url).toString())
                if (!r.ok) throw new Error(`segment ${r.status}`)
                return r.text()
              }),
            )
            for (const res of batch) {
              if (res.status === 'fulfilled') texts.push(res.value)
            }
          }
          if (cancelled) return
          const multi = segments.length > 1
          cues = texts.flatMap(segText => {
            const offset = multi ? segmentTimestampOffset(segText) : 0
            return parseVTT(segText).map(cue => ({ ...cue, start: cue.start + offset, end: cue.end + offset }))
          })
        } else {
          cues = parseVTT(text)
        }

        if (cancelled) return
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
