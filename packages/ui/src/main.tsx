import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './app/providers/theme-provider'
import { DrawerProvider } from './app/providers/drawer-provider'
import { SmoothScrollProvider } from './app/providers/smooth-scroll-provider'
import { HistoryProvider } from './app/providers/history-provider'
import { Toaster } from 'sonner'
import { StartupOverlay } from './components/StartupOverlay'
import './lib/i18n'
import App from './app/App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <SmoothScrollProvider>
          <HistoryProvider>
          <DrawerProvider>
            <App />
            <StartupOverlay />
            <Toaster position="bottom-right" richColors />
          </DrawerProvider>
          </HistoryProvider>
        </SmoothScrollProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
