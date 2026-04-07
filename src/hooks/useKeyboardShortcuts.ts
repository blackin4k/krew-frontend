import { useEffect } from 'react';
import { usePlayerStore } from '@/stores/playerStore';

export function useKeyboardShortcuts() {
    const {
        togglePlay,
        next,
        prev,
        setVolume,
        volume,
        toggleShuffle,
        toggleRepeat,
        toggleExpanded,
        setExpanded,
    } = usePlayerStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in an input
            const target = e.target as HTMLElement;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            ) {
                return;
            }

            // F11: Toggle Fullscreen
            if (e.code === 'F11') {
                e.preventDefault();
                window.electronAPI?.toggleFullscreen();
            }

            // Space: Play/Pause
            if (e.code === 'Space') {
                e.preventDefault(); // Prevent scrolling
                togglePlay();
            }

            // Tab: Toggle Expanded Player
            if (e.code === 'Tab') {
                e.preventDefault(); // Prevent focus switch
                toggleExpanded();
            }

            // Escape: Close Expanded Player
            if (e.code === 'Escape') {
                e.preventDefault();
                setExpanded(false);
            }

            // Media Keys (Hardware)
            if (e.code === 'MediaPlayPause') togglePlay();
            if (e.code === 'MediaTrackNext') next();
            if (e.code === 'MediaTrackPrevious') prev();

            // Ctrl Combinations
            if (e.ctrlKey || e.metaKey) { // Support Cmd on Mac too ideally
                switch (e.key) {
                    case 'ArrowRight':
                        e.preventDefault();
                        next();
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        prev();
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        setVolume(Math.min(1, volume + 0.1));
                        break;
                    case 'ArrowDown':
                        e.preventDefault();
                        setVolume(Math.max(0, volume - 0.1));
                        break;
                    case 's': // Shift+s sometimes? Spotify uses Ctrl+S for shuffle
                    case 'S':
                        e.preventDefault();
                        toggleShuffle();
                        break;
                    case 'r':
                    case 'R':
                        e.preventDefault();
                        toggleRepeat();
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, next, prev, setVolume, volume, toggleShuffle, toggleRepeat, toggleExpanded, setExpanded]);
}
