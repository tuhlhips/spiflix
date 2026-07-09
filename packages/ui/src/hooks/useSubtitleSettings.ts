import { usePersistentState } from './useLocalStorage'

export interface SubtitleSettings {
  fontSize: 'sm' | 'md' | 'lg' | 'xl'
  color: string
  bgOpacity: 'none' | 'low' | 'medium' | 'high'
  position: 'bottom' | 'top'
}

export const DEFAULT_SUBTITLE_SETTINGS: SubtitleSettings = {
  fontSize: 'md',
  color: '#ffffff',
  bgOpacity: 'medium',
  position: 'bottom',
}

export function useSubtitleSettings() {
  return usePersistentState<SubtitleSettings>('spiflix-subtitle-settings', DEFAULT_SUBTITLE_SETTINGS)
}

export const FONT_SIZES = [
  { value: 'sm' as const, label: 'Small', className: 'text-sm' },
  { value: 'md' as const, label: 'Medium', className: 'text-lg' },
  { value: 'lg' as const, label: 'Large', className: 'text-2xl' },
  { value: 'xl' as const, label: 'X-Large', className: 'text-3xl' },
]

export const COLORS = [
  { value: '#ffffff', label: 'White', swatch: 'bg-white' },
  { value: '#fbbf24', label: 'Yellow', swatch: 'bg-yellow-400' },
  { value: '#34d399', label: 'Green', swatch: 'bg-emerald-400' },
  { value: '#22d3ee', label: 'Cyan', swatch: 'bg-cyan-400' },
  { value: '#f87171', label: 'Red', swatch: 'bg-red-400' },
  { value: '#a78bfa', label: 'Purple', swatch: 'bg-violet-400' },
]

export const BG_OPACITIES = [
  { value: 'none' as const, label: 'None' },
  { value: 'low' as const, label: 'Low' },
  { value: 'medium' as const, label: 'Medium' },
  { value: 'high' as const, label: 'High' },
]

export const POSITIONS = [
  { value: 'bottom' as const, label: 'Bottom' },
  { value: 'top' as const, label: 'Top' },
]
