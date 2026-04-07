import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlayerStore } from '@/stores/playerStore';
import { useUIStore } from '@/stores/uiStore';

const BackButtonHandler = () => {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // We wrap the listener in an async function to await the listener result
        let listenerHandle: any = null;

        const setupListener = async () => {
            listenerHandle = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
                // 1. Check if Sidebar is open
                const { isSidebarOpen, setSidebarOpen } = useUIStore.getState();
                if (isSidebarOpen) {
                    setSidebarOpen(false);
                    return;
                }

                // 2. Check if Expanded Player is open
                // Access state directly to avoid stale closures if we didn't depend on it
                const { isExpanded, setExpanded, showDashboard, setShowDashboard, showLyrics, setShowLyrics } = usePlayerStore.getState();

                if (showLyrics) {
                    setShowLyrics(false);
                    return;
                }

                if (showDashboard) {
                    setShowDashboard(false);
                    return;
                }

                if (isExpanded) {
                    setExpanded(false);
                    return;
                }

                // 2. Handle Navigation
                // We use the current location from the hook which updates this effect
                if (location.pathname !== '/' && location.pathname !== '/home') {
                    navigate(-1);
                } else {
                    // 3. Exit App if on root
                    CapacitorApp.exitApp();
                }
            });
        };

        setupListener();

        return () => {
            if (listenerHandle) {
                listenerHandle.remove();
            }
        };
    }, [navigate, location]); // Re-bind when location changes to ensure correct path logic

    return null;
};

export default BackButtonHandler;
