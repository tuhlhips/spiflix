interface RegionOption {
  value: string
  label: string
}

let cached: RegionOption[] | null = null

export function getRegionOptions(): RegionOption[] {
  if (cached) return cached
  const codes = new Intl.DisplayNames(['en'], { type: 'region' })
  const all: RegionOption[] = []
  for (let i = 0; i < 300; i++) {
    const alpha2 = String.fromCharCode(65 + (i % 26), 65 + Math.floor(i / 26))
    try {
      const label = codes.of(alpha2)
      if (label && label !== alpha2) all.push({ value: alpha2, label })
    } catch {}
  }
  cached = all.sort((a, b) => a.label.localeCompare(b.label))
  return cached
}
