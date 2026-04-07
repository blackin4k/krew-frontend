import { Toaster } from "@/components/ui/toaster"
import { Toaster as Sonner } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom"
import { useAuthStore } from "@/stores/authStore"
import { usePlayerStore } from "@/stores/playerStore"
import { lazy, Suspense, useEffect } from "react"
import { authApi } from "@/lib/api"
import { Capacitor } from "@capacitor/core"
import { SplashScreen } from "@capacitor/splash-screen"
import { JamManager } from "./components/JamManager"
import BackButtonHandler from "./components/BackButtonHandler"
import NotificationPermissionHandler from "./components/NotificationPermissionHandler"
import DeepLinkHandler from "./components/DeepLinkHandler"
import ThemeController from "./components/ThemeController"

const queryClient = new QueryClient()
const Auth = lazy(() => import("./pages/Auth"))
const Home = lazy(() => import("./pages/Home"))
const Profile = lazy(() => import("./pages/Profile"))
const Search = lazy(() => import("./pages/Search"))
const PlaylistPage = lazy(() => import("./pages/PlaylistPage"))
const Library = lazy(() => import("./pages/Library"))
const LikedSongs = lazy(() => import("./pages/LikedSongs"))
const RecentSongs = lazy(() => import("./pages/RecentSongs"))
const Playlists = lazy(() => import("./pages/Playlists"))
const GenrePage = lazy(() => import("./pages/GenrePage"))
const Albums = lazy(() => import("./pages/Albums"))
const Artists = lazy(() => import("./pages/Artists"))
const ArtistPage = lazy(() => import("./pages/ArtistPage"))
const AlbumPage = lazy(() => import("./pages/AlbumPage"))
const Queue = lazy(() => import("./pages/Queue"))
const Radio = lazy(() => import("./pages/Radio"))
const Upload = lazy(() => import("./pages/Upload"))
const Jam = lazy(() => import("./pages/Jam"))
const CapsulePage = lazy(() => import("./pages/CapsulePage"))
const RequestSong = lazy(() => import("./pages/RequestSong"))
const NotFound = lazy(() => import("./pages/NotFound"))
const OfflineLibrary = lazy(() => import("./pages/OfflineLibrary"))
const AppLayout = lazy(() => import("./components/AppLayout"))

const RouteFallback = () => (
  <div className="min-h-screen bg-[#0A0A0C] text-white">
    <div className="mx-auto max-w-[1920px] px-4 md:px-6 pt-[calc(env(safe-area-inset-top)+2rem)]">
      <div className="h-8 w-40 rounded-md bg-white/10 animate-pulse" />
      <div className="mt-8 h-[120px] w-full rounded-[28px] bg-white/5 animate-pulse" />
      <div className="mt-8 flex gap-4 overflow-hidden">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-[100px] min-w-[100px] rounded-[18px] bg-white/5 animate-pulse" />
        ))}
      </div>
    </div>
  </div>
)

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, user, setUser } = useAuthStore()
  const loadQueue = usePlayerStore((state) => state.loadQueue)

  useEffect(() => {
    if (!isAuthenticated) return

    let cancelled = false
    let timeoutId: number | null = null

    const syncUser = async () => {
      try {
        const res = await authApi.me()
        if (!cancelled) {
          setUser(res.data)
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error)
        }
      }
    }

    if (!user) {
      syncUser()
    } else {
      // Let the first screen render before refreshing profile details.
      timeoutId = window.setTimeout(syncUser, 1500)
    }

    return () => {
      cancelled = true
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [isAuthenticated, user, setUser])

  useEffect(() => {
    if (!isAuthenticated) return
    loadQueue()
  }, [isAuthenticated, loadQueue])

  if (!isAuthenticated) return <Navigate to="/auth" replace />
  return <>{children}</>
}

// Redirects authenticated users away from the login page
const PublicOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/" replace />
  return <>{children}</>
}

const App = () => {
  // Hide the native splash screen once the React app has mounted.
  // Native auto-hide is disabled so Android doesn't sit on the splash screen
  // longer than necessary while the JS bundle boots.
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide({ fadeOutDuration: 300 }).catch(console.warn);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner position="top-center" richColors />
        <JamManager />
        <BrowserRouter>
          <ThemeController />
          <BackButtonHandler />
          <NotificationPermissionHandler />
          <DeepLinkHandler />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public Auth Route */}
              <Route
                path="/auth"
                element={
                  <PublicOnlyRoute>
                    <Auth />
                  </PublicOnlyRoute>
                }
              />

              {/* Protected Main Layout Wrapper */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Outlet />
                    </AppLayout>
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Home />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/search" element={<Search />} />
                <Route path="/request" element={<RequestSong />} />
                <Route path="/playlist/:id" element={<PlaylistPage />} />

                <Route path="/library" element={<Library />}>
                  <Route path="liked" element={<LikedSongs />} />
                  <Route path="playlists" element={<Playlists />} />
                  <Route path="recent" element={<RecentSongs />} />
                  <Route path="offline" element={<OfflineLibrary />} />
                </Route>

                <Route path="/genre/:genre" element={<GenrePage />} />
                <Route path="/albums" element={<Albums />} />
                <Route path="/album/:name" element={<AlbumPage />} />
                <Route path="/artists" element={<Artists />} />
                <Route path="/artist/:name" element={<ArtistPage />} />
                <Route path="/queue" element={<Queue />} />
                <Route path="/radio" element={<Radio />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/jam" element={<Jam />} />
                <Route path="/capsule" element={<CapsulePage />} />
              </Route>

              {/* Public 404 Catch-All */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

export default App
