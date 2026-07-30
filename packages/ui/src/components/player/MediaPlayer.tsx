import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import Hls from 'hls.js'
import { api } from '@/lib/api'
import { formatTime, cn } from '@/lib/utils'
import { usePlaybackProgress } from '@/hooks/usePlaybackProgress'
import { useHistory } from '@/app/providers/history-provider'
import { usePersistentState } from '@/hooks/useLocalStorage'
import { useSubtitleSettings, FONT_SIZES, COLORS, BG_OPACITIES, POSITIONS } from '@/hooks/useSubtitleSettings'
import { sortSources, isHls, subtitlesForSource, pickSubtitle } from '@/utils/playback'
import type { Source, Subtitle } from '@/utils/playback'
import { fetchSegments, type IntroDBSegment } from '@/services/introdb'
import { findPreferredAudioTrack, getPreferredAudioLang, setPreferredAudioLang, languageName } from '@/utils/audio'
import { usePresenceMeta } from '@/hooks/usePresenceMeta'
import { useSafeBack } from '@/hooks/useSafeBack'
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, SkipBack, SkipForward, ArrowLeft, List,
  PictureInPicture, PictureInPicture2, Subtitles,
  Captions, Gauge, Clapperboard, Check,
  RotateCcw, RotateCw, Monitor, Server,
} from 'lucide-react'
import { CustomSubtitles } from './CustomSubtitles'

type WebKitVideo = HTMLVideoElement & {
  webkitEnterFullscreen?: () => void
  webkitExitFullscreen?: () => void
  webkitPresentationMode?: 'inline' | 'picture-in-picture' | 'fullscreen'
  webkitSetPresentationMode?: (mode: 'inline' | 'picture-in-picture' | 'fullscreen') => void
}

type WebKitDocument = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

interface MediaPlayerProps {
  tmdbId: number
  type: 'movie' | 'tv'
  season?: number
  episode?: number
  onToggleEpisodes?: () => void
}

interface AudioTrack {
  language: string
  label: string
}

type SettingsTab = 'quality' | 'speed' | 'subtitles' | 'audio' | 'captions'

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

export function MediaPlayer({ tmdbId, type, season, episode, onToggleEpisodes }: MediaPlayerProps) {
  const { t } = useTranslation('player')
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const navigate = useNavigate()
  const goBack = useSafeBack(type === 'tv' ? '/shows' : '/movies')
  const { save: saveProgress, getResumeTime, clear: clearProgress } = usePlaybackProgress(type, tmdbId, season, episode)
  const history = useHistory()

  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [isPiP, setIsPiP] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [sources, setSources] = useState<Source[]>([])
  const [selectedSource, setSelectedSource] = useState<Source | null>(null)
  const [title, setTitle] = useState('')
  const [posterPath, setPosterPath] = useState<string | null>(null)
  const [episodeTitle, setEpisodeTitle] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('subtitles')
  const [playbackRate, setPlaybackRate] = useState(1)
  const [qualities, setQualities] = useState<{ index: number; height: number; label: string }[]>([])
  const [currentQuality, setCurrentQuality] = useState(-1)
  const [showAutoplay, setShowAutoplay] = useState(false)
  const [autoplayCountdown, setAutoplayCountdown] = useState(5)
  const autoplayTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const autoplayInterval = useRef<ReturnType<typeof setInterval>>(undefined)
  const [subtitles, setSubtitles] = useState<Subtitle[]>([])
  const subtitlesRef = useRef<Subtitle[]>([])
  subtitlesRef.current = subtitles
  const [selectedSubtitle, setSelectedSubtitle] = useState<Subtitle | null>(null)
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<AudioTrack | null>(null)
  const [subSettings, setSubSettings] = useSubtitleSettings()
  const [introSegments, setIntroSegments] = useState<IntroDBSegment[]>([])
  const [activeSegment, setActiveSegment] = useState<IntroDBSegment | null>(null)
  const [autoSkipIntro] = usePersistentState('spiflix-auto-skip-intro', false)
  const [autoplayNext] = usePersistentState('spiflix-autoplay-next', true)
  const [buffered, setBuffered] = useState(0)
  const [sourcesOpen, setSourcesOpen] = useState(false)

  usePresenceMeta({ title, posterPath, type, season, episode, episodeTitle })

  const controlsTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const stalledTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // --- Source failover ---------------------------------------------------
  // Sources ranked best-first (preferred audio language, then quality). When
  // the active stream turns out to be dead or malformed (e.g. Icefy sometimes
  // serves a headerless master), we advance to the next untried source instead
  // of stranding the user on a playback error.
  const orderedSourcesRef = useRef<Source[]>([])
  const failedSourceUrls = useRef<Set<string>>(new Set())
  // A manual pick from the Source settings tab opts out of auto-failover so we
  // don't yank the user off the source they deliberately chose.
  const manualSourceRef = useRef(false)
  const selectedSourceRef = useRef<Source | null>(null)
  selectedSourceRef.current = selectedSource

  /**
   * Mark the current source failed and switch to the next viable one. Returns
   * true if it moved to another source, false when the list is exhausted (in
   * which case it surfaces the playback error).
   */
  const failoverToNextSource = useCallback(() => {
    const failed = selectedSourceRef.current
    if (failed) failedSourceUrls.current.add(failed.url)
    if (manualSourceRef.current) {
      setError(t('errors.playback_error'))
      return false
    }
    const next = orderedSourcesRef.current.find(s => !failedSourceUrls.current.has(s.url))
    if (next) {
      console.warn(`[Player] Source failed, failing over to ${next.provider.name} (${next.quality})`)
      setLoading(true)
      setError(null)
      setSelectedSource(next)
      // Pick a subtitle compatible with the new source — clears if none match.
      setSelectedSubtitle(prev => {
        if (!prev || prev.providerId !== next.provider?.id) {
          return pickSubtitle(next, subtitlesRef.current, getPreferredAudioLang()) || null
        }
        return prev
      })
      return true
    }
    setError(t('errors.playback_error'))
    return false
  }, [t])

  // Fetch sources
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setShowAutoplay(false)
    setSelectedSource(null)
    const video = videoRef.current
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    clearTimeout(autoplayTimer.current)

    const fetcher = type === 'movie'
      ? api.sources.movie(tmdbId)
      : api.sources.tv(tmdbId, season || 1, episode || 1)

    fetcher
      .then(data => {
        if (cancelled) return
        setSources(data.sources || [])
        setSubtitles(data.subtitles || [])
        setSelectedAudioTrack(null)
        // Rank all sources once, reset failover bookkeeping, start on the best.
        const allSubs = data.subtitles || []
        const ordered = sortSources(data.sources || [], getPreferredAudioLang())
        orderedSourcesRef.current = ordered
        failedSourceUrls.current = new Set()
        manualSourceRef.current = false
        const preferred = ordered[0]
        if (preferred) {
          setAudioTracks(preferred.audioTracks || [])
          setSelectedSource(preferred)
          setSelectedSubtitle(pickSubtitle(preferred, allSubs, getPreferredAudioLang()) || null)
        } else {
          setAudioTracks([])
          setSelectedSubtitle(null)
          setError(t('errors.no_sources'))
        }
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [tmdbId, type, season, episode, t])

  // Fetch title + IMDb ID + IntroDB segments
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    api.tmdb.details(type, tmdbId)
      .then(data => {
        if (cancelled) return
        setTitle(data.title || data.name || '')
        setPosterPath(data.poster_path || null)
        // Fetch the real episode title from season data (not the series name)
        if (type === 'tv' && season != null && episode != null) {
          api.tmdb.season(tmdbId, season)
            .then(seasonData => {
              if (cancelled) return
              const ep = seasonData.episodes?.find((e: any) => e.episode_number === episode)
              if (ep?.name) setEpisodeTitle(ep.name)
            })
            .catch(() => {})
        } else {
          setEpisodeTitle(null)
        }

        // Extract imdb_id from external_ids (TV) or direct field (movie)
        const imdbId = data.imdb_id || data.external_ids?.imdb_id
        // IntroDB only carries TV segment data — movie lookups 400 upstream,
        // so skip them instead of logging a warning on every movie.
        if (!imdbId || type !== 'tv') return

        // Fetch IntroDB segments for intro/recap/outro timing
        fetchSegments(imdbId, season, episode, controller.signal)
          .then(segs => { if (!cancelled) setIntroSegments(segs) })
          .catch(err => {
            if (err.name !== 'AbortError') console.warn('IntroDB fetch failed (non-fatal):', err)
          })

      })
      .catch(() => {})

    return () => { cancelled = true; controller.abort() }
  }, [tmdbId, type, season, episode])

  // Attach HLS.js when source changes
  useEffect(() => {
    const video = videoRef.current
    if (!video || !selectedSource) return

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    const url = selectedSource.url
    setQualities([])
    setCurrentQuality(-1)
    // Reset the audio picker to this source's own tracks. HLS sources refine
    // this later via AUDIO_TRACKS_UPDATED; mp4 sources keep the provider list.
    // Without this, switching/failing over to another source (especially mp4)
    // would leave the previous source's tracks showing.
    setAudioTracks(selectedSource.audioTracks ?? [])
    setSelectedAudioTrack(null)

    let watchId: ReturnType<typeof setTimeout> | undefined

    if (isHls(selectedSource)) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
        hlsRef.current = hls
        let networkRetries = 0
        // Destroy without tripping the effect-cleanup double-destroy guard.
        const destroyHls = () => {
          hls.destroy()
          if (hlsRef.current === hls) hlsRef.current = null
        }

        hls.loadSource(url)
        hls.attachMedia(video)

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // A parsed-but-empty master (e.g. Icefy's headerless variant list) is
          // unplayable — treat it as a dead source and move on.
          if (hls.levels.length === 0) {
            destroyHls()
            failoverToNextSource()
            return
          }
          setLoading(false)
          setQualities(hls.levels.map((l, i) => ({ index: i, height: l.height, label: `${l.height}p` })))

          const resume = getResumeTime()
          if (resume) {
            video.currentTime = resume
          }
          video.play().catch(() => {})
        })

        // Audio tracks are NOT available at MANIFEST_PARSED on this stream.
        // They populate lazily after AUDIO_TRACK_LOADING. Listen to
        // AUDIO_TRACKS_UPDATED to set the preferred language once tracks arrive.
        let initialAudioTrackSet = false
        const preferredLang = getPreferredAudioLang()

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
          const tracks = data.audioTracks
          if (!tracks || tracks.length === 0 || initialAudioTrackSet) return
          initialAudioTrackSet = true

          setAudioTracks(tracks.map((t, i) => ({
            language: t.lang ?? '',
            label: t.name ?? t.lang ?? `Track ${i}`,
          })))

          const preferred = findPreferredAudioTrack(tracks, preferredLang)
          if (preferred) {
            // Only switch when it isn't already active, but always sync React
            // state to it — otherwise, when the default track already matches
            // the preference, selectedAudioTrack stays null forever and the
            // Audio settings tab never shows any track as selected.
            if (preferred.id !== hls.audioTrack) {
              hls.audioTrack = preferred.id
              console.info(`[Player] Audio track set to: ${preferred.name ?? preferred.lang} (id: ${preferred.id})`)
            }
            setSelectedAudioTrack({ language: tracks[preferred.id].lang ?? '', label: tracks[preferred.id].name ?? tracks[preferred.id].lang ?? `Track ${preferred.id}` })
          }
        })

        // Watchdog: if after 3 seconds the active track isn't preferred, re-apply
        watchId = setTimeout(() => {
          if (initialAudioTrackSet) return
          const track = hls.audioTracks?.[hls.audioTrack]
          if (track) {
            const preferred = findPreferredAudioTrack(hls.audioTracks, preferredLang)
            if (preferred && preferred.id !== hls.audioTrack) {
              hls.audioTrack = preferred.id
              console.warn('[Player] Watchdog re-applied audio track selection')
            }
          }
        }, 3000)

        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          setCurrentQuality(data.level)
        })

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return

          // Manifest/level-level failures mean this source is broken, not just
          // congested — reloading would loop forever, so fail over immediately.
          const manifestFatal =
            data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR ||
            data.details === Hls.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR ||
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
            data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
            data.details === Hls.ErrorDetails.LEVEL_EMPTY_ERROR
          if (manifestFatal) {
            destroyHls()
            failoverToNextSource()
            return
          }

          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            // Retry a transient network hiccup a few times before giving up on
            // the source entirely.
            if (networkRetries < 3) {
              networkRetries++
              hls.startLoad()
              return
            }
            destroyHls()
            failoverToNextSource()
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError()
          } else {
            destroyHls()
            failoverToNextSource()
          }
        })
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = url
      }
    } else {
      video.src = url
    }

    return () => {
      clearTimeout(watchId)
      // hlsRef.current?.destroy() is called at the top of this effect when a new source is selected
      // and in the cleanup below. Avoid double-destroy.
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [selectedSource, getResumeTime, t, failoverToNextSource])

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate
  }, [playbackRate])

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      if (Math.floor(video.currentTime) % 10 === 0) {
        saveProgress(video.currentTime, video.duration)
        history.add({ id: tmdbId, type, title: title || (type === 'tv' ? `S${season}E${episode}` : String(tmdbId)), posterPath, season, episode, currentTime: video.currentTime, duration: video.duration })
      }
    }
    const onDurationChange = () => setDuration(video.duration)
    const onWaiting = () => setLoading(true)
    const onPlaying = () => {
      clearTimeout(stalledTimer.current)
      setLoading(false)
    }
    const onStalled = () => {
      setLoading(true)
      clearTimeout(stalledTimer.current)
      stalledTimer.current = window.setTimeout(() => {
        // Still starved after 5s — try the next source before surfacing an
        // error (failoverToNextSource itself errors when the list is spent).
        if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA && !video.paused) failoverToNextSource()
      }, 5_000)
    }
    // abort fires during normal source switches/failovers too, so it must not
    // set an error itself — genuinely dead streams surface via stalled/error.
    const onAbort = () => setLoading(false)
    const onProgress = () => {
      try {
        const ranges = video.buffered
        if (ranges.length > 0 && Number.isFinite(video.duration) && video.duration > 0) {
          setBuffered(ranges.end(ranges.length - 1) / video.duration)
        }
      } catch {}
    }
    const onError = () => {
      setLoading(false)
      // hls.js-managed sources report fatal errors through the Hls ERROR event;
      // only the native <video> paths (mp4, or HLS on Safari) surface here, so
      // fail those over to the next source before giving up.
      const src = selectedSourceRef.current
      const hlsManaged = src != null && isHls(src) && Hls.isSupported()
      if (!hlsManaged && failoverToNextSource()) return
      setError(t('errors.playback_error'))
    }
    const onFullscreenChange = () => {
      const webkitDocument = document as WebKitDocument
      const isFs = Boolean(document.fullscreenElement || webkitDocument.webkitFullscreenElement)
      setFullscreen(isFs)
      // Release the landscape lock when leaving fullscreen by any means
      // (OS back-gesture, Esc), not only via the button.
      if (!isFs) { try { (screen.orientation as any)?.unlock?.() } catch {} }
    }
    const onWebKitPresentationModeChange = () => {
      setIsPiP((video as WebKitVideo).webkitPresentationMode === 'picture-in-picture')
      setFullscreen((video as WebKitVideo).webkitPresentationMode === 'fullscreen')
    }
    const onVolumeChange = () => { setVolume(video.volume); setMuted(video.muted) }
    // Keep isPiP in sync when PiP is entered/exited via the browser's own UI
    // (the floating window's close button never goes through togglePiP).
    const onEnterPiP = () => setIsPiP(true)
    const onLeavePiP = () => setIsPiP(false)
    const onEnded = () => {
      clearProgress()
      setPlaying(false)
      if (autoplayNext && type === 'tv' && season !== undefined && episode !== undefined) {
        setShowAutoplay(true)
      }
    }

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('stalled', onStalled)
    video.addEventListener('abort', onAbort)
    video.addEventListener('progress', onProgress)
    video.addEventListener('error', onError)
    video.addEventListener('webkitpresentationmodechanged', onWebKitPresentationModeChange)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    document.addEventListener('webkitfullscreenchange', onFullscreenChange)
    video.addEventListener('volumechange', onVolumeChange)
    video.addEventListener('ended', onEnded)
    video.addEventListener('enterpictureinpicture', onEnterPiP)
    video.addEventListener('leavepictureinpicture', onLeavePiP)

    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('stalled', onStalled)
      video.removeEventListener('abort', onAbort)
      video.removeEventListener('progress', onProgress)
      video.removeEventListener('error', onError)
      video.removeEventListener('webkitpresentationmodechanged', onWebKitPresentationModeChange)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange)
      clearTimeout(stalledTimer.current)
      video.removeEventListener('volumechange', onVolumeChange)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('enterpictureinpicture', onEnterPiP)
      video.removeEventListener('leavepictureinpicture', onLeavePiP)
    }
  }, [tmdbId, type, season, episode, clearProgress, history, saveProgress, t, title, posterPath, failoverToNextSource, autoplayNext])

  const moveEpisode = useCallback(async (direction: 1 | -1) => {
    if (type !== 'tv' || season === undefined || episode === undefined) return false
    try {
      const current = await api.tmdb.season(tmdbId, season) as { episodes?: Array<{ episode_number: number }> }
      const episodes = current.episodes || []
      const index = episodes.findIndex(item => item.episode_number === episode)
      const adjacent = episodes[index + direction]
      if (adjacent) {
        navigate(`/watch/tv/${tmdbId}?s=${season}&e=${adjacent.episode_number}`)
        return true
      }

      const details = await api.tmdb.details('tv', tmdbId) as { seasons?: Array<{ season_number: number; episode_count: number }> }
      const seasons = (details.seasons || []).filter(item => item.episode_count > 0)
      const seasonIndex = seasons.findIndex(item => item.season_number === season)
      const nextSeason = seasons[seasonIndex + direction]
      if (!nextSeason) return false
      const target = await api.tmdb.season(tmdbId, nextSeason.season_number) as { episodes?: Array<{ episode_number: number }> }
      const targetEpisodes = target.episodes || []
      const targetEpisode = direction === 1 ? targetEpisodes[0] : targetEpisodes.at(-1)
      if (!targetEpisode) return false
      navigate(`/watch/tv/${tmdbId}?s=${nextSeason.season_number}&e=${targetEpisode.episode_number}`)
      return true
    } catch {
      return false
    }
  }, [episode, navigate, season, tmdbId, type])

  const handleAutoplayNext = useCallback(() => {
    setShowAutoplay(false)
    clearTimeout(autoplayTimer.current)
    void moveEpisode(1)
  }, [moveEpisode])

  useEffect(() => {
    if (showAutoplay) {
      setAutoplayCountdown(5)
      autoplayTimer.current = setTimeout(handleAutoplayNext, 5000)
      autoplayInterval.current = setInterval(() => {
        setAutoplayCountdown(p => Math.max(0, p - 1))
      }, 1000)
      return () => {
        clearTimeout(autoplayTimer.current)
        clearInterval(autoplayInterval.current)
      }
    }
  }, [showAutoplay, handleAutoplayNext])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return
      // The seek bar has its own key handling (±5s, Home/End) — without this
      // guard both handlers fire and ArrowLeft jumps 15s instead of 5.
      if (target.getAttribute('role') === 'slider') return

      const video = videoRef.current
      if (!video) return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          if (video.paused) video.play(); else video.pause()
          break
        case 'ArrowLeft':
          e.preventDefault()
          video.currentTime = Math.max(0, video.currentTime - 10)
          break
        case 'ArrowRight':
          e.preventDefault()
          video.currentTime = Math.min(video.duration, video.currentTime + 10)
          break
        case 'ArrowUp':
          e.preventDefault()
          video.volume = Math.min(1, video.volume + 0.05)
          break
        case 'ArrowDown':
          e.preventDefault()
          video.volume = Math.max(0, video.volume - 0.05)
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
        case 'm':
          e.preventDefault()
          video.muted = !video.muted
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Ref mirror so the hide-timer closure sees the live value — otherwise the
  // settings menu vanishes mid-interaction 3s after the last mouse move.
  const showSettingsRef = useRef(false)
  showSettingsRef.current = showSettings
  const settingsRef = useRef<HTMLDivElement>(null)
  const sourcePopoverRef = useRef<HTMLDivElement>(null)

  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => {
      if (playing && !showSettingsRef.current) setShowControls(false)
    }, 3000)
  }, [playing])

  // Close the settings popover on any pointer press outside it.
  useEffect(() => {
    if (!showSettings) return
    const onDown = (e: PointerEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [showSettings])

  // Close the source popover on any pointer press outside it.
  useEffect(() => {
    if (!sourcesOpen) return
    const onDown = (e: PointerEvent) => {
      if (sourcePopoverRef.current && !sourcePopoverRef.current.contains(e.target as Node)) {
        setSourcesOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [sourcesOpen])

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play(); else video.pause()
  }

  // On touch devices the first tap should reveal the controls, not pause the
  // video. The emulated mousemove that precedes `click` already flips
  // showControls on, so remember whether they were visible when the touch
  // actually started.
  const controlsVisibleAtTouchStart = useRef(true)
  const handleVideoTouchStart = () => {
    controlsVisibleAtTouchStart.current = showControls
  }
  const handleVideoClick = () => {
    if (sourcesOpen) { setSourcesOpen(false); return }
    const coarse = window.matchMedia('(pointer: coarse)').matches
    if (coarse && !controlsVisibleAtTouchStart.current) {
      controlsVisibleAtTouchStart.current = true
      resetControlsTimer()
      return
    }
    togglePlay()
  }

  // Best-effort landscape lock while in fullscreen on phones. Supported on
  // Android Chrome; iOS Safari throws (its native fullscreen auto-rotates
  // anyway), so every call is guarded.
  function lockLandscape() {
    try { void (screen.orientation as any)?.lock?.('landscape').catch(() => {}) } catch {}
  }
  function unlockOrientation() {
    try { (screen.orientation as any)?.unlock?.() } catch {}
  }

  async function toggleFullscreen() {
    const container = containerRef.current
    if (!container) return
    const webkitDocument = document as WebKitDocument
    const video = videoRef.current as WebKitVideo | null
    if (document.fullscreenElement || webkitDocument.webkitFullscreenElement || video?.webkitPresentationMode === 'fullscreen') {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (webkitDocument.webkitExitFullscreen) await webkitDocument.webkitExitFullscreen()
      else video?.webkitExitFullscreen?.()
      unlockOrientation()
      setFullscreen(false)
    } else {
      if (container.requestFullscreen) await container.requestFullscreen()
      else video?.webkitEnterFullscreen?.()
      lockLandscape()
      setFullscreen(true)
    }
  }

  async function togglePiP() {
    const video = videoRef.current as WebKitVideo | null
    if (!video) return
    try {
      if ('pictureInPictureEnabled' in document && document.pictureInPictureEnabled) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture()
          setIsPiP(false)
        } else {
          await video.requestPictureInPicture()
          setIsPiP(true)
        }
      } else if (video.webkitSetPresentationMode) {
        const nextMode = video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture'
        video.webkitSetPresentationMode(nextMode)
        setIsPiP(nextMode === 'picture-in-picture')
      } else {
        throw new Error('Picture in Picture is not supported')
      }
    } catch {}
  }

  // Click + drag scrubbing on the seek bar via pointer capture.
  const scrubbingRef = useRef(false)
  const seekToClientX = (clientX: number, el: HTMLElement) => {
    const video = videoRef.current
    // duration is NaN until metadata loads; assigning NaN to currentTime throws.
    if (!video || !Number.isFinite(video.duration)) return
    const rect = el.getBoundingClientRect()
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    video.currentTime = pct * video.duration
  }
  const seekPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    scrubbingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    seekToClientX(e.clientX, e.currentTarget)
  }
  const seekPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubbingRef.current) seekToClientX(e.clientX, e.currentTarget)
  }
  const seekPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    scrubbingRef.current = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
  }

  const seekWithKeyboard = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration)) return

    const step = 5
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault()
        video.currentTime = Math.max(0, video.currentTime - step)
        break
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault()
        video.currentTime = Math.min(video.duration, video.currentTime + step)
        break
      case 'Home':
        e.preventDefault()
        video.currentTime = 0
        break
      case 'End':
        e.preventDefault()
        video.currentTime = video.duration
        break
    }
  }

  const handleQualityChange = (level: number) => {
    if (!hlsRef.current) return
    hlsRef.current.currentLevel = level
    setCurrentQuality(level)
  }

  // Compute active segment based on currentTime
  useEffect(() => {
    const seg = introSegments.find(s => currentTime >= s.start_sec && currentTime <= s.end_sec - 1) ?? null
    setActiveSegment(prev => prev?.segment_type === seg?.segment_type ? prev : seg)
  }, [currentTime, introSegments])

  // Auto-skip intro if enabled
  useEffect(() => {
    if (autoSkipIntro && activeSegment?.segment_type === 'intro' && videoRef.current) {
      videoRef.current.currentTime = activeSegment.end_sec
      setActiveSegment(null)
    }
  }, [autoSkipIntro, activeSegment])

  // Switch audio track when selected
  useEffect(() => {
    const hls = hlsRef.current
    if (!hls || !selectedAudioTrack || hls.audioTracks.length === 0) return
    // HLS.js audioTracks use `name` (EXT-X-MEDIA NAME) and `lang` (LANGUAGE)
    const idx = hls.audioTracks.findIndex(t =>
      t.name === selectedAudioTrack.label || t.lang === selectedAudioTrack.language
    )
    if (idx >= 0 && idx !== hls.audioTrack) {
      hls.audioTrack = idx
      setPreferredAudioLang(hls.audioTracks[idx].lang || hls.audioTracks[idx].name || 'en')
    }
  }, [selectedAudioTrack])

  return (
    <div
      ref={containerRef}
      className="relative flex h-screen w-full bg-black items-center justify-center"
      onMouseMove={resetControlsTimer}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      {/* Back button */}
      {showControls && (
        <button
          onClick={goBack}
          className="absolute top-4 left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
          aria-label="Go back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}

      {/* Video element */}
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        onClick={handleVideoClick}
        onTouchStart={handleVideoTouchStart}
        playsInline
        crossOrigin="anonymous"
      />

      {/* Subtitles overlay */}
      {selectedSubtitle && (
        <CustomSubtitles url={selectedSubtitle.url} videoRef={videoRef} />
      )}

      {/* Loading spinner */}
      {loading && !showAutoplay && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="h-12 w-12 animate-spin rounded-full border-3 border-white border-t-transparent" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-center">
            <p className="text-white text-lg mb-4">{error}</p>
            <button
              onClick={goBack}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
            >
              {t('controls.go_back')}
            </button>
          </div>
        </div>
      )}

      {/* Autoplay countdown overlay */}
      {showAutoplay && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
          <div className="text-center space-y-6 w-full max-w-sm px-8">
            <p className="text-white text-lg font-medium">{t('states.next_episode_soon')}</p>

            {/* Progress bar */}
            <div className="relative h-2 w-full rounded-full bg-white/20 overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-1000 ease-linear"
                style={{ width: `${(autoplayCountdown / 5) * 100}%` }}
              />
            </div>
            <p className="text-white/60 text-sm">{autoplayCountdown}s</p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleAutoplayNext}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {t('controls.play_next')}
              </button>
              <button
                onClick={() => { setShowAutoplay(false); clearTimeout(autoplayTimer.current); clearInterval(autoplayInterval.current) }}
                className="rounded-lg bg-white/10 px-4 py-2.5 text-sm text-white hover:bg-white/20 transition-colors"
              >
                {t('controls.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skip segment button */}
      {activeSegment && (
        <button
          onClick={() => {
            if (videoRef.current) videoRef.current.currentTime = activeSegment.end_sec
            setActiveSegment(null)
          }}
          className="absolute bottom-24 right-6 z-30 px-5 py-2 rounded-md bg-background/80 backdrop-blur-sm border border-border text-sm font-medium text-foreground hover:bg-background transition-all animate-in fade-in slide-in-from-bottom-2 duration-200"
          aria-label={t(`controls.skip_${activeSegment.segment_type}`)}
        >
          {t(`controls.skip_${activeSegment.segment_type}`)}
        </button>
      )}

      {/* Center play flash — shown whenever paused (independent of chrome), a
          soft cue that a click resumes. Pointer-events pass through to the video. */}
      {!playing && !loading && !error && !showAutoplay && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/25">
          <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-black/50 shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-sm">
            <Play className="ml-1 h-9 w-9 fill-white text-white" />
          </div>
        </div>
      )}

      {/* Controls overlay */}
      {showControls && !error && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {/* Top bar — gradient + kicker + title. pl-16 clears the absolute back
              button (top-4 left-4) so the title never renders underneath it. */}
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-6 pl-16">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-white/60">
              {type === 'tv' && season !== undefined && episode !== undefined
                ? `S${season} : E${episode}`
                : t(type === 'movie' ? 'controls.movie' : 'controls.series')}
            </p>
            <h1 className="mt-0.5 line-clamp-1 text-lg font-bold text-white">
              {title}
            </h1>
          </div>

          {/* Bottom controls */}
          <div className="pointer-events-auto absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-6 pb-6 pt-10 space-y-2.5">
            {/* Seek bar */}
            <div
              onPointerDown={seekPointerDown}
              onPointerMove={seekPointerMove}
              onPointerUp={seekPointerUp}
              onKeyDown={seekWithKeyboard}
              className="group relative flex h-4 w-full cursor-pointer touch-none select-none items-center"
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            >
              <div className="relative h-[5px] w-full rounded-full bg-white/25">
                {/* Buffered range */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white/30"
                  style={{ width: `${buffered * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
                {/* Knob with accent glow (handoff spec) */}
                <div
                  className="pointer-events-none absolute top-1/2 h-[15px] w-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_30%,transparent)]"
                  style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 10) }}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
                  aria-label={t('controls.back_10s')}
                >
                  <RotateCcw className="h-[21px] w-[21px]" />
                </button>

                <button onClick={togglePlay} className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:brightness-110" aria-label={playing ? t('controls.pause') : t('controls.play')} aria-pressed={playing}>
                  {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
                </button>

                <button
                  onClick={() => { const v = videoRef.current; if (v) v.currentTime = Math.min(v.duration || Infinity, v.currentTime + 10) }}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-colors hover:bg-white/15"
                  aria-label={t('controls.forward_10s')}
                >
                  <RotateCw className="h-[21px] w-[21px]" />
                </button>

                {type === 'tv' && (
                  <button
                    onClick={() => void moveEpisode(-1)}
                    className="text-white/70 hover:text-white"
                          aria-label={t('controls.previous_episode')}
                  >
                    <SkipBack className="h-5 w-5" />
                  </button>
                )}

                {type === 'tv' && (
                  <button
                    onClick={() => void moveEpisode(1)}
                    className="text-white/70 hover:text-white"
                    aria-label={t('controls.next_episode')}
                  >
                    <SkipForward className="h-5 w-5" />
                  </button>
                )}

                {/* Volume */}
                <button onClick={() => videoRef.current && (videoRef.current.muted = !videoRef.current.muted)} className="text-white/70 hover:text-white" aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}>
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={muted ? 0 : volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0 }
                  }}
                  // Hidden on phones (hardware volume handles it) so the cramped
                  // control bar has room for the time + right-side buttons.
                  className="hidden sm:block w-20 accent-primary"
                  aria-label="Volume"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round((muted ? 0 : volume) * 100)}
                />

                <span className="text-sm font-medium text-white/90 tabular-nums ml-2">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Episode selector for TV */}
                {type === 'tv' && onToggleEpisodes && (
                  <button
                    onClick={onToggleEpisodes}
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label={t('controls.episodes')}
                  >
                    <List className="h-4 w-4" />
                    {t('controls.episodes')}
                  </button>
                )}

                {/* Source selector */}
                <div className="relative" ref={sourcePopoverRef}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSourcesOpen(!sourcesOpen) }}
                    className={cn(
                      'flex items-center gap-2 h-9 rounded-full px-3 text-[13px] font-bold text-white transition-colors border',
                      sourcesOpen
                        ? 'bg-white/20'
                        : 'bg-white/10 border-transparent hover:bg-white/20',
                    )}
                    style={sourcesOpen ? { borderColor: 'color-mix(in srgb, var(--accent) 60%, transparent)' } : undefined}
                    aria-label="Select source"
                    aria-haspopup="true"
                    aria-expanded={sourcesOpen}
                  >
                    <Server className="h-[17px] w-[17px]" />
                    <span className="truncate max-w-[100px]">{selectedSource?.provider?.name ?? 'Source'}</span>
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="transition-transform duration-200"
                      style={{ transform: sourcesOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <path d="m6 9 6 6 6-6"></path>
                    </svg>
                  </button>

                  {sourcesOpen && (
                    <div
                      className="absolute right-0 bottom-[calc(100%+12px)] w-[320px] rounded-2xl border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.6)] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
                      style={{ background: 'rgba(20,20,20,0.98)' }}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-[14px] border-b border-white/7">
                        <span className="text-[14px] font-extrabold text-white">Select Source</span>
                        <span className="text-[11px] font-semibold text-[#8f8f8f]">{sources.length} servers</span>
                      </div>

                      {/* Scrollable list */}
                      <div className="max-h-[280px] overflow-y-auto">
                        {sources.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-white/40">No sources available</div>
                        ) : (
                          sources.map((src, i) => {
                            const isSelected = selectedSource === src
                            const isRecommended = i === 0 && !manualSourceRef.current
                            const qualityLabel = /^\d+$/.test(src.quality) ? `${src.quality}p` : src.quality === 'auto' ? 'Auto' : src.quality
                            const tier = src.provider?.id === 'vidnest' ? 'fast' : src.provider?.id === 'vidsrc' ? 'fast' : src.provider?.id === 'vidlink' ? 'fast' : src.provider?.id === 'icefy' ? 'med' : 'slow'
                            const pingLabel = tier === 'fast' ? 'Fast' : tier === 'med' ? 'Medium' : 'Slow'
                            const pingColor = tier === 'fast' ? '#12b981' : tier === 'med' ? '#eda000' : '#e05555'
                            return (
                              <button
                                key={src.url}
                                onClick={() => {
                                  manualSourceRef.current = true
                                  setError(null)
                                  setSelectedSource(src)
                                  setSourcesOpen(false)
                                  setSelectedSubtitle(prev => {
                                    if (!prev || prev.providerId !== src.provider?.id) {
                                      return pickSubtitle(src, subtitlesRef.current, getPreferredAudioLang()) || null
                                    }
                                    return prev
                                  })
                                }}
                                className={cn(
                                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/6',
                                  isSelected && 'bg-accent/12',
                                )}
                              >
                                <span className={cn(
                                  'flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]',
                                  isSelected ? 'bg-accent' : 'bg-white/10',
                                )}>
                                  <Monitor className="h-[17px] w-[17px] text-white" />
                                </span>
                                <span className="flex-1 min-w-0">
                                  <span className="flex items-center gap-[7px]">
                                    <span className="text-[14px] font-bold text-[#f0f0f0]">{src.provider?.name ?? `Source ${i + 1}`}</span>
                                    {isRecommended && (
                                      <span className="rounded-[5px] text-[9px] font-extrabold tracking-[0.05em] uppercase text-white px-[6px] py-[1px]"
                                        style={{ background: 'color-mix(in srgb, var(--accent) 22%, transparent)' }}
                                      >
                                        Best
                                      </span>
                                    )}
                                  </span>
                                  <span className="flex items-center gap-2 mt-[3px]">
                                    <span className="text-[11px] font-semibold text-[#8f8f8f]">{src.type === 'hls' ? 'Auto' : qualityLabel}</span>
                                    <span className="inline-flex items-center gap-[4px] text-[11px]" style={{ color: pingColor }}>
                                      <span className="w-[6px] h-[6px] rounded-full" style={{ background: pingColor }}></span>
                                      {pingLabel}
                                    </span>
                                  </span>
                                </span>
                                {isSelected && <Check className="h-[18px] w-[18px] shrink-0" style={{ stroke: 'var(--accent)' }} strokeWidth={2.6} />}
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Settings popover */}
                <div className="relative" ref={settingsRef}>
                  <button
                    onClick={() => { setSourcesOpen(false); setShowSettings(!showSettings) }}
                    className="text-white/70 hover:text-white"
                    aria-label="Settings"
                    aria-haspopup="true"
                    aria-expanded={showSettings}
                  >
                    <Settings className="h-5 w-5" />
                  </button>

                  {showSettings && (
                    <div className="absolute bottom-full right-0 mb-2 w-72 rounded-lg bg-black/90 backdrop-blur-xl border border-white/10 shadow-xl max-h-[70vh] flex flex-col">
                      {/* Tab bar — a real tablist: it switches panels below, it is
                          not a menu of actions. */}
                      <div className="flex border-b border-white/10" role="tablist" aria-label="Player settings">
                        {([
                          { id: 'subtitles' as SettingsTab, icon: Captions },
                          { id: 'audio' as SettingsTab, icon: Volume2 },
                          { id: 'quality' as SettingsTab, icon: Clapperboard },
                          { id: 'speed' as SettingsTab, icon: Gauge },
                          { id: 'captions' as SettingsTab, icon: Subtitles },
                        ]).map(({ id, icon: Icon }) => (
                          <button
                            key={id}
                            role="tab"
                            aria-selected={settingsTab === id}
                            onClick={() => setSettingsTab(id)}
                            className={cn(
                              'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors capitalize',
                              settingsTab === id
                                ? 'text-white bg-white/10'
                                : 'text-white/50 hover:text-white/80',
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {/* Labels live under controls.* — already translated in every
                                locale, unlike the settings.* section which only had `source`. */}
                            {t(`controls.${id === 'captions' ? 'style' : id}`)}
                          </button>
                        ))}
                      </div>

                      {/* Content */}
                      <div className="flex-1 overflow-y-auto p-2 min-h-0 max-h-64" role="tabpanel">
                        {/* Source picking lives in the control-bar chip, not here. */}

                        {/* Subtitles — filtered to match current source's provider */}
                        {settingsTab === 'subtitles' && (
                          <div className="space-y-0.5">
                            <button
                              onClick={() => setSelectedSubtitle(null)}
                              className={cn(
                                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                !selectedSubtitle ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                              )}
                            >
                              <span>{t('settings.off')}</span>
                              {!selectedSubtitle && <Check className="h-3 w-3" />}
                            </button>
                            {(() => {
                              const compatible = selectedSource ? subtitlesForSource(selectedSource, subtitles) : subtitles
                              if (compatible.length === 0) {
                                return <p className="text-xs text-white/40 px-2 py-1">{t('settings.no_subtitles')}</p>
                              }
                              return compatible.map((sub, i) => (
                                <button
                                  key={i}
                                  onClick={() => { setSelectedSubtitle(sub); setShowSettings(false) }}
                                  className={cn(
                                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                    selectedSubtitle === sub ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                  )}
                                >
                                  <span>{sub.label}</span>
                                  {selectedSubtitle === sub && <Check className="h-3 w-3" />}
                                </button>
                              ))
                            })()}
                          </div>
                        )}

                        {/* Audio */}
                        {settingsTab === 'audio' && (() => {
                          // Track switching only works through hls.js — for mp4/mkv
                          // (or native HLS) the embedded tracks can't be changed, so
                          // show them as informational instead of pretending.
                          const canSwitchAudio = selectedSource != null && isHls(selectedSource) && Hls.isSupported()
                          return (
                            <div className="space-y-0.5">
                              {audioTracks.length === 0 ? (
                                <p className="text-xs text-white/40 px-2 py-1">{t('settings.no_audio_tracks')}</p>
                              ) : (
                                <>
                                  {!canSwitchAudio && audioTracks.length > 1 && (
                                    <p className="text-[10px] text-white/40 px-2 py-1">{t('settings.audio_locked')}</p>
                                  )}
                                  {audioTracks.map((track, i) => {
                                    const isSelected = selectedAudioTrack?.label === track.label && selectedAudioTrack?.language === track.language
                                    return (
                                      <button
                                        key={i}
                                        disabled={!canSwitchAudio}
                                        onClick={() => { setSelectedAudioTrack(track); setShowSettings(false) }}
                                        className={cn(
                                          'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                          isSelected ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                          !canSwitchAudio && 'opacity-50 cursor-default hover:bg-transparent',
                                        )}
                                      >
                                        <span>{languageName(track.language, track.label)}</span>
                                        {isSelected && <Check className="h-3 w-3" />}
                                      </button>
                                    )
                                  })}
                                </>
                              )}
                            </div>
                          )
                        })()}

                        {/* Quality */}
                        {settingsTab === 'quality' && (
                          <div className="space-y-0.5">
                            <button
                              onClick={() => handleQualityChange(-1)}
                              className={cn(
                                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                currentQuality === -1 ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                              )}
                            >
                              <span>{t('settings.auto')}</span>
                              {currentQuality === -1 && <Check className="h-3 w-3" />}
                            </button>
                            {qualities.map(q => (
                              <button
                                key={q.index}
                                onClick={() => handleQualityChange(q.index)}
                                className={cn(
                                  'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                  currentQuality === q.index ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                )}
                              >
                                <span>{q.label}</span>
                                {currentQuality === q.index && <Check className="h-3 w-3" />}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Speed */}
                        {settingsTab === 'speed' && (
                          <div className="space-y-0.5">
                            {PLAYBACK_RATES.map(rate => (
                              <button
                                key={rate}
                                onClick={() => { setPlaybackRate(rate); setShowSettings(false) }}
                                className={cn(
                                  'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                  playbackRate === rate ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                )}
                              >
                                <span>{rate}x</span>
                                {playbackRate === rate && <Check className="h-3 w-3" />}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Captions style */}
                        {settingsTab === 'captions' && (
                          <div className="space-y-4 p-1">
                            <div>
                              <p className="text-[10px] text-white/40 mb-1.5 uppercase tracking-wider">Font Size</p>
                              <div className="flex gap-1">
                                {FONT_SIZES.map(f => (
                                  <button
                                    key={f.value}
                                    onClick={() => setSubSettings({ ...subSettings, fontSize: f.value })}
                                    className={cn(
                                      'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                      subSettings.fontSize === f.value ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                    )}
                                  >
                                    {f.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-white/40 mb-1.5 uppercase tracking-wider">Color</p>
                              <div className="flex gap-2">
                                {COLORS.map(c => (
                                  <button
                                    key={c.value}
                                    onClick={() => setSubSettings({ ...subSettings, color: c.value })}
                                    className={cn('h-6 w-6 rounded-full ring-offset-2 ring-offset-black transition-all', subSettings.color === c.value ? 'ring-2 ring-white scale-110' : '')}
                                    title={c.label}
                                  >
                                    <div className={cn('h-full w-full rounded-full', c.swatch)} />
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-white/40 mb-1.5 uppercase tracking-wider">Background</p>
                              <div className="flex gap-1">
                                {BG_OPACITIES.map(b => (
                                  <button
                                    key={b.value}
                                    onClick={() => setSubSettings({ ...subSettings, bgOpacity: b.value })}
                                    className={cn(
                                      'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                      subSettings.bgOpacity === b.value ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                    )}
                                  >
                                    {b.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] text-white/40 mb-1.5 uppercase tracking-wider">Position</p>
                              <div className="flex gap-1">
                                {POSITIONS.map(p => (
                                  <button
                                    key={p.value}
                                    onClick={() => setSubSettings({ ...subSettings, position: p.value })}
                                    className={cn(
                                      'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                                      subSettings.position === p.value ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                    )}
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick speed cycle */}
                <button
                  onClick={() => { const s = [0.5, 1, 1.25, 1.5, 2]; const i = s.indexOf(playbackRate); setPlaybackRate(s[(i + 1) % s.length] ?? 1) }}
                  className="h-9 rounded-full bg-white/10 px-3 text-[13px] font-bold tabular-nums text-white transition-colors hover:bg-white/20"
                  aria-label={t('controls.speed')}
                >
                  {playbackRate}×
                </button>

                {/* Picture in Picture */}
                <button
                  onClick={togglePiP}
                  className="text-white/70 hover:text-white"
                  aria-label={isPiP ? t('controls.exit_picture_in_picture') : t('controls.picture_in_picture')}
                  aria-pressed={isPiP}
                >
                  {isPiP ? <PictureInPicture2 className="h-4 w-4" /> : <PictureInPicture className="h-4 w-4" />}
                </button>

                <button
                  onClick={toggleFullscreen}
                  className="text-white/70 hover:text-white"
                  aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  aria-pressed={fullscreen}
                >
                  {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
