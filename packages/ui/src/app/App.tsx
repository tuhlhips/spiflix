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
const Surprise = lazy(() => import('../pages/surprise/Surprise'))
const Search = lazy(() => import('../pages/search/Search'))
const MyList = lazy(() => import('../pages/my-list/MyList'))
const Episodes = lazy(() => import('../pages/episodes/Episodes'))
const Profiles = lazy(() => import('../pages/profiles/Profiles'))
const Party = lazy(() => import('../pages/party/Party'))
const PartyRoom = lazy(() => import('../pages/party/PartyRoom'))
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
            <Route path="/search" element={<Search />} />
            <Route path="/my-list" element={<MyList />} />
            <Route path="/tv/:id/episodes" element={<Episodes />} />
            <Route path="/party" element={<Party />} />
            <Route path="/surprise" element={<Surprise />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
          </Route>
          <Route element={<BlankLayout />}>
            <Route path="/profiles" element={<Profiles />} />
            <Route path="/party/:room" element={<PartyRoom />} />
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
