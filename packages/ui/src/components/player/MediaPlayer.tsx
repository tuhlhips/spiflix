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
import { getPreferredSource, isHls } from '@/utils/playback'
import { fetchSegments, type IntroDBSegment } from '@/services/introdb'
import { findPreferredAudioTrack, getPreferredAudioLang, setPreferredAudioLang } from '@/utils/audio'
import { usePresenceMeta } from '@/hooks/usePresenceMeta'
import { useSafeBack } from '@/hooks/useSafeBack'
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, SkipBack, SkipForward, ArrowLeft, List,
  PictureInPicture, PictureInPicture2, Subtitles,
  HardDrive, Captions, Gauge, Clapperboard, Check,
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

import type { Source } from '@/utils/playback'

interface Subtitle {
  url: string
  label: string
  format: string
}

interface AudioTrack {
  language: string
  label: string
}

type SettingsTab = 'source' | 'quality' | 'speed' | 'subtitles' | 'audio' | 'captions'

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
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('source')
  const [playbackRate, setPlaybackRate] = useState(1)
  const [qualities, setQualities] = useState<{ index: number; height: number; label: string }[]>([])
  const [currentQuality, setCurrentQuality] = useState(-1)
  const [showAutoplay, setShowAutoplay] = useState(false)
  const [autoplayCountdown, setAutoplayCountdown] = useState(5)
  const autoplayTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const autoplayInterval = useRef<ReturnType<typeof setInterval>>(undefined)
  const [subtitles, setSubtitles] = useState<Subtitle[]>([])
  const [selectedSubtitle, setSelectedSubtitle] = useState<Subtitle | null>(null)
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([])
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<AudioTrack | null>(null)
  const [subSettings, setSubSettings] = useSubtitleSettings()
  const [introSegments, setIntroSegments] = useState<IntroDBSegment[]>([])
  const [activeSegment, setActiveSegment] = useState<IntroDBSegment | null>(null)
  const [autoSkipIntro] = usePersistentState('spiflix-auto-skip-intro', false)

  usePresenceMeta({ title, posterPath, type, season, episode, episodeTitle })

  const controlsTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const stalledTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

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
        setSelectedSubtitle(null)
        setSelectedAudioTrack(null)
        const preferred = getPreferredSource(data.sources || [])
        if (preferred) {
          setAudioTracks(preferred.audioTracks || [])
          setSelectedSource(preferred)
        } else {
          setAudioTracks([])
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
        if (!imdbId) return

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

    let watchId: ReturnType<typeof setTimeout> | undefined

    if (isHls(selectedSource)) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
        hlsRef.current = hls

        hls.loadSource(url)
        hls.attachMedia(video)

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false)
          if (hls.levels.length > 0) {
            setQualities(hls.levels.map((l, i) => ({ index: i, height: l.height, label: `${l.height}p` })))
          }

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
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              hls.startLoad()
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError()
            } else {
              setError(t('errors.playback_error'))
              hls.destroy()
            }
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
  }, [selectedSource, getResumeTime, t])

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
        history.add({ id: tmdbId, type, title: title || (type === 'tv' ? `S${season}E${episode}` : String(tmdbId)), currentTime: video.currentTime, duration: video.duration })
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
        if (video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA && !video.paused) setError(t('errors.playback_error'))
      }, 5_000)
    }
    const onAbort = () => {
      if (!video.paused) setError(t('errors.playback_error'))
      setLoading(false)
    }
    const onError = () => {
      setLoading(false)
      setError(t('errors.playback_error'))
    }
    const onFullscreenChange = () => {
      const webkitDocument = document as WebKitDocument
      setFullscreen(Boolean(document.fullscreenElement || webkitDocument.webkitFullscreenElement))
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
      if (type === 'tv' && season !== undefined && episode !== undefined) {
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
  }, [tmdbId, type, season, episode, clearProgress, history, saveProgress, t, title])

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

  const resetControlsTimer = useCallback(() => {
    setShowControls(true)
    clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => {
      if (playing) setShowControls(false)
    }, 3000)
  }, [playing])

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) video.play(); else video.pause()
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
      setFullscreen(false)
    } else {
      if (container.requestFullscreen) await container.requestFullscreen()
      else video?.webkitEnterFullscreen?.()
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

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current
    // duration is NaN until metadata loads; assigning NaN to currentTime throws.
    if (!video || !Number.isFinite(video.duration)) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    video.currentTime = pct * video.duration
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
        onClick={togglePlay}
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
          className="absolute bottom-24 right-6 z-30 px-5 py-2 rounded-md bg-background/80 backdrop-blur-sm border border-border text-sm font-medium text-foreground hover:bg-background transition-all duration-150 animate-in fade-in slide-in-from-bottom-2 duration-200"
          aria-label={t(`controls.skip_${activeSegment.segment_type}`)}
        >
          {t(`controls.skip_${activeSegment.segment_type}`)}
        </button>
      )}

      {/* Controls overlay */}
      {showControls && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/20 via-transparent to-black/15">
          {/* Top bar — title */}
          <div className="absolute top-0 left-0 right-0 p-4">
            <h1 className="text-white text-lg font-medium line-clamp-1">
              {title}
              {type === 'tv' && season !== undefined && episode !== undefined && (
                <span className="text-white/60 ml-2">S{season} E{episode}</span>
              )}
            </h1>
          </div>

          {/* Bottom controls */}
          <div className="pointer-events-auto absolute bottom-0 left-0 right-0 p-4 space-y-2">
            {/* Seek bar */}
            <div
              onClick={seek}
              onKeyDown={seekWithKeyboard}
              className="group relative h-1.5 w-full cursor-pointer rounded-full bg-white/20 transition-all hover:h-2.5"
              role="slider"
              tabIndex={0}
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>

            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={togglePlay} className="text-white hover:bg-white/20 rounded-full p-1.5 transition-colors" aria-label={playing ? 'Pause' : 'Play'} aria-pressed={playing}>
                  {playing ? <Pause className="h-6 w-6 fill-current" /> : <Play className="h-6 w-6 fill-current" />}
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
                  className="w-20 accent-primary"
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

                {/* Settings popover */}
                <div className="relative">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-white/70 hover:text-white"
                    aria-label="Settings"
                    aria-haspopup="true"
                    aria-expanded={showSettings}
                  >
                    <Settings className="h-5 w-5" />
                  </button>

                  {showSettings && (
                    <div className="absolute bottom-full right-0 mb-2 w-72 rounded-lg bg-black/90 backdrop-blur-xl border border-white/10 shadow-xl max-h-[70vh] flex flex-col" role="menu">
                      {/* Tab bar */}
                      <div className="flex border-b border-white/10">
                        {([
                          { id: 'source' as SettingsTab, icon: HardDrive },
                          { id: 'subtitles' as SettingsTab, icon: Captions },
                          { id: 'audio' as SettingsTab, icon: Volume2 },
                          { id: 'quality' as SettingsTab, icon: Clapperboard },
                          { id: 'speed' as SettingsTab, icon: Gauge },
                          { id: 'captions' as SettingsTab, icon: Subtitles },
                        ]).map(({ id, icon: Icon }) => (
                          <button
                            key={id}
                            onClick={() => setSettingsTab(id)}
                            className={cn(
                              'flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors',
                              settingsTab === id
                                ? 'text-white bg-white/10'
                                : 'text-white/50 hover:text-white/80',
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {id === 'captions' ? 'Style' : id}
                          </button>
                        ))}
                      </div>

                      {/* Content */}
                      <div className="flex-1 overflow-y-auto p-2 min-h-0 max-h-64">
                        {/* Source */}
                        {settingsTab === 'source' && (
                          <div className="space-y-1">
                            {sources.length === 0 ? (
                              <p className="text-xs text-white/40 px-2 py-1">{t('settings.no_sources')}</p>
                            ) : (
                              (() => {
                                const grouped = sources.reduce<Record<string, typeof sources>>((acc, s) => {
                                  const provider = s.provider.name
                                  if (!acc[provider]) acc[provider] = []
                                  acc[provider].push(s)
                                  return acc
                                }, {})
                                return Object.entries(grouped).map(([provider, providerSources]) => (
                                  <div key={provider} className="mb-3 last:mb-0">
                                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/40">{provider}</div>
                                    <div className="mt-0.5 space-y-0.5">
                                      {providerSources.map((s, i) => {
                                        const isSelected = selectedSource === s
                                        return (
                                          <button
                                            key={`${s.provider.id}-${i}`}
                                            onClick={() => { setSelectedSource(s); setShowSettings(false) }}
                                            className={cn(
                                              'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                                              isSelected ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                            )}
                                          >
                                            <span>
                                              <span className="font-medium">Source {i + 1}</span>
                                              <span className="ml-1.5 text-white/40">{s.quality}</span>
                                            </span>
                                            {isSelected && <Check className="h-3 w-3" />}
                                          </button>
                                        )
                                      })}
                                    </div>
                                  </div>
                                ))
                              })()
                            )}
                          </div>
                        )}

                        {/* Subtitles */}
                        {settingsTab === 'subtitles' && (
                          <div className="space-y-0.5">
                            <button
                              onClick={() => setSelectedSubtitle(null)}
                              className={cn(
                                'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                !selectedSubtitle ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                              )}
                            >
                              <span>Off</span>
                              {!selectedSubtitle && <Check className="h-3 w-3" />}
                            </button>
                            {subtitles.length === 0 ? (
                              <p className="text-xs text-white/40 px-2 py-1">{t('settings.no_subtitles')}</p>
                            ) : (
                              subtitles.map((sub, i) => (
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
                            )}
                          </div>
                        )}

                        {/* Audio */}
                        {settingsTab === 'audio' && (
                          <div className="space-y-0.5">
                            {audioTracks.length === 0 ? (
                              <p className="text-xs text-white/40 px-2 py-1">No audio tracks available</p>
                            ) : (
                              audioTracks.map((track, i) => {
                                const isSelected = selectedAudioTrack?.label === track.label && selectedAudioTrack?.language === track.language
                                return (
                                  <button
                                    key={i}
                                    onClick={() => { setSelectedAudioTrack(track); setShowSettings(false) }}
                                    className={cn(
                                      'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors',
                                      isSelected ? 'bg-primary/20 text-primary' : 'text-white/70 hover:bg-white/10',
                                    )}
                                  >
                                    <span>{track.label || track.language}</span>
                                    {isSelected && <Check className="h-3 w-3" />}
                                  </button>
                                )
                              })
                            )}
                          </div>
                        )}

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
                              <span>Auto</span>
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

                {/* Picture in Picture */}
                <button
                  onClick={togglePiP}
                  className="text-white/70 hover:text-white"
                  aria-label={isPiP ? 'Exit Picture in Picture' : 'Picture in Picture'}
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
