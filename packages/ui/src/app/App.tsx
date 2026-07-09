import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { BlankLayout } from './layouts/BlankLayout'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { MediaDrawer } from '../components/media/MediaDrawer'

const Home = lazy(() => import('../pages/home/Home'))
const Movies = lazy(() => import('../pages/movies/Movies'))
const Shows = lazy(() => import('../pages/shows/Shows'))
const Discover = lazy(() => import('../pages/discover/Discover'))
const Settings = lazy(() => import('../pages/settings/Settings'))
const Disclaimer = lazy(() => import('../pages/disclaimer/Disclaimer'))
const WatchMovie = lazy(() => import('../pages/watch/movie/WatchMovie'))
const WatchTv = lazy(() => import('../pages/watch/tv/WatchTv'))
const NotFound = lazy(() => import('../pages/NotFound'))

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/movies" element={<Movies />} />
            <Route path="/shows" element={<Shows />} />
            <Route path="/discover" element={<Discover />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
          </Route>
          <Route element={<BlankLayout />}>
            <Route path="/watch/movie/:id" element={<WatchMovie />} />
            <Route path="/watch/tv/:id" element={<WatchTv />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
        <MediaDrawer />
      </Suspense>
    </ErrorBoundary>
  )
}
