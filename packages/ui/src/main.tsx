import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './app/providers/theme-provider'
import { SettingsProvider } from './app/providers/settings-provider'
import { ProfilesProvider } from './app/providers/profiles-provider'
import { SavedListProvider } from './app/providers/saved-list-provider'
import { DrawerProvider } from './app/providers/drawer-provider'
import { SmoothScrollProvider } from './app/providers/smooth-scroll-provider'
import { HistoryProvider } from './app/providers/history-provider'
import { Toaster } from 'sonner'
import { StartupOverlay } from './components/StartupOverlay'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'
import './lib/i18n'
import App from './app/App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <SettingsProvider>
          <ProfilesProvider>
            <SavedListProvider>
              <SmoothScrollProvider>
                <HistoryProvider>
                  <DrawerProvider>
                    <App />
                    <StartupOverlay />
                    <PwaUpdatePrompt />
                    <Toaster position="bottom-right" richColors />
                  </DrawerProvider>
                </HistoryProvider>
              </SmoothScrollProvider>
            </SavedListProvider>
          </ProfilesProvider>
        </SettingsProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
