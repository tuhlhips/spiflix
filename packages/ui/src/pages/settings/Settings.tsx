import { useTheme } from '@/app/providers/theme-provider'
import { Monitor, Moon, Sun, Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

const themes = [
  { id: 'dark' as const, label: 'Dark', icon: Moon },
  { id: 'light' as const, label: 'Light', icon: Sun },
  { id: 'system' as const, label: 'System', icon: Monitor },
]

const colorThemes = [
  { id: 'default' as const, label: 'Red', color: 'bg-red-500' },
  { id: 'blue' as const, label: 'Blue', color: 'bg-blue-500' },
  { id: 'green' as const, label: 'Green', color: 'bg-green-500' },
  { id: 'purple' as const, label: 'Purple', color: 'bg-purple-500' },
  { id: 'amber' as const, label: 'Amber', color: 'bg-amber-500' },
  { id: 'sky' as const, label: 'Sky', color: 'bg-sky-500' },
  { id: 'rose' as const, label: 'Rose', color: 'bg-rose-500' },
]

export default function Settings() {
  const { theme, colorTheme, setTheme, setColorTheme } = useTheme()

  return (
    <div className="mx-auto max-w-2xl py-8 px-4 sm:px-6">
      <h1 className="text-2xl font-bold mb-8">Settings</h1>

      {/* Theme section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Appearance
        </h2>

        {/* Theme mode */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-3">Theme</p>
          <div className="flex gap-2">
            {themes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTheme(id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                  theme === id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Color theme */}
        <div>
          <p className="text-sm text-muted-foreground mb-3">Accent Color</p>
          <div className="flex gap-2">
            {colorThemes.map(({ id, label, color }) => (
              <button
                key={id}
                onClick={() => setColorTheme(id)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full transition-all',
                  colorTheme === id && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                )}
                title={label}
              >
                <div className={cn('h-5 w-5 rounded-full', color)} />
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
