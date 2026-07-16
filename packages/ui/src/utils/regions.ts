interface RegionOption {
  value: string
  label: string
}

let cached: RegionOption[] | null = null

export function getRegionOptions(): RegionOption[] {
  if (cached) return cached
  const codes = new Intl.DisplayNames(['en'], { type: 'region' })
  const all: RegionOption[] = []
  // Enumerate every 2-letter combination (AA..ZZ = 26*26 = 676) to cover the
  // full ISO 3166-1 alpha-2 space. The previous bound of 300 silently cut off
  // any code whose second letter was past 'L', dropping major regions like
  // US, JP, FR, IN, IT, ES, and MX from the list entirely.
  for (let i = 0; i < 676; i++) {
    const alpha2 = String.fromCharCode(65 + (i % 26), 65 + Math.floor(i / 26))
    try {
      const label = codes.of(alpha2)
      if (label && label !== alpha2) all.push({ value: alpha2, label })
    } catch {}
  }
  cached = all.sort((a, b) => a.label.localeCompare(b.label))
  return cached
}
