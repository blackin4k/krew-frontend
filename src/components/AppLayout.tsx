import { Suspense, lazy, useEffect, useState } from "react";
import { SidebarContent } from "./Sidebar";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import OfflineBanner from "./OfflineBanner";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useUIStore } from "@/stores/uiStore";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const Player = lazy(() => import("./Player"));
const Visualizer = lazy(() => import("./Visualizer"));
const OfflineLibrary = lazy(() => import("@/pages/OfflineLibrary"));

export default function AppLayout({ children }: { children: React.ReactNode }) {
  useKeyboardShortcuts();
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const { isOnline } = useNetworkStatus();
  const [showBackgroundVisualizer, setShowBackgroundVisualizer] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const sync = () => setShowBackgroundVisualizer(mediaQuery.matches);

    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0a0a]">
      <OfflineBanner />
      {/* Background Visualizer - Taller and Behind Content */}
      {showBackgroundVisualizer && (
        <Suspense fallback={null}>
          <Visualizer className="absolute bottom-0 left-0 w-full h-[60%] pointer-events-none z-0 opacity-40 mix-blend-screen" />
        </Suspense>
      )}
      <Sidebar />

      {/* Mobile Sidebar Sheet (Controlled by UI Store) */}
      <div className="md:hidden">
        <Sheet open={isSidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 border-r border-white/10 bg-black/90 backdrop-blur-3xl w-[80%] max-w-[300px]">
            <SidebarContent mode="mobile" onNavigate={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content Area */}
      <main className="absolute top-0 right-0 bottom-0 left-0 md:left-72 overflow-y-auto pb-40 md:pb-32 pt-0 pr-0 pl-0 md:pt-4 md:pr-4 z-10">
        {/* Inner Content Container - Translucent background for the "page" feel */}
        <div className="min-h-full w-full md:rounded-2xl bg-[#121212]/95 backdrop-blur-md overflow-hidden relative">
          {isOnline ? children : (
            <Suspense fallback={null}>
              <OfflineLibrary />
            </Suspense>
          )}
        </div>
      </main>

      <MobileNav />

      {/* Player Slot - Positioned by Player component itself or wrapper? 
          We'll keep a wrapper for DOM order but let Player component control its 'floating-ness' 
          actually the plan says modify Player.tsx to be fixed. 
          But here we can just put it in the flow, usually Player uses portals or fixed.
          Let's just render it. The previous layout had a div wrapper. 
          We will remove the limiting wrapper.
      */}
      <Suspense fallback={null}>
        <Player />
      </Suspense>
    </div>
  );
}
