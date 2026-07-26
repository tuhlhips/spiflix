import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import Backend from 'i18next-http-backend'
import LanguageDetector from 'i18next-browser-languagedetector'

// Migrate JSON-quoted locale values left behind by older Settings code
// ('"en"' instead of 'en') — they would otherwise leak into the locale
// load path (/locales/"en"/...) and API query params.
try {
  const stored = localStorage.getItem('spiflix-locale')
  if (stored && /^".*"$/.test(stored)) {
    localStorage.setItem('spiflix-locale', JSON.parse(stored))
  }
} catch { /* private browsing or corrupted value — detector will fall back */ }

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    // Languages we ship translations for. Bounding this prevents i18next from
    // requesting a locale we don't have (the SPA redirect would answer the
    // missing /locales/<lng>/*.json with index.html, which then fails to parse
    // as JSON). Any unshipped detection result falls back to English.
    supportedLngs: ['en', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
    // Map region-qualified navigator languages (en-US, de-DE) to their base
    // locale so detection resolves to a file we actually ship.
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      // Unified with the TMDB content-language key: one selector in Settings
      // drives both the interface language and TMDB metadata language.
      lookupLocalStorage: 'spiflix-locale',
    },
  })

export default i18n
