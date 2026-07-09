export function parseVTT(text: string) {
  const lines = text.split(/\r?\n/)
  const cues: { start: number; end: number; text: string }[] = []
  let currentCue: { start: number; end: number; text: string } | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (line.includes('-->')) {
      const parts = line.split('-->')
      const startStr = parts[0].trim()
      const endStr = parts[1].trim().split(' ')[0]

      const start = parseVTTTime(startStr)
      const end = parseVTTTime(endStr)

      currentCue = { start, end, text: '' }
    } else if (line === '') {
      if (currentCue) {
        cues.push(currentCue)
        currentCue = null
      }
    } else if (currentCue) {
      currentCue.text += (currentCue.text ? '\n' : '') + line
    }
  }

  if (currentCue) cues.push(currentCue)
  return cues
}

function parseVTTTime(timeStr: string) {
  const parts = timeStr.split(':')
  let hours: number
  let minutes: number
  let seconds: number

  if (parts.length === 3) {
    hours = parseFloat(parts[0])
    minutes = parseFloat(parts[1])
    seconds = parseFloat(parts[2])
  } else {
    hours = 0
    minutes = parseFloat(parts[0])
    seconds = parseFloat(parts[1])
  }

  return hours * 3600 + minutes * 60 + seconds
}
