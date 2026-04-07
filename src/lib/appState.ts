/**
 * App State Persistence Manager
 * Saves and restores app state across sessions
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { usePlayerStore } from '@/stores/playerStore';
import { useAuthStore } from '@/stores/authStore';

interface AppState {
  player: {
    currentSongId: number | null;
    queue: number[];
    volume: number;
    shuffle: boolean;
    repeat: 'off' | 'all' | 'one';
  };
  auth: {
    token: string | null;
    userId: number | null;
  };
  timestamp: number;
}

const STATE_KEY = 'krew_app_state';
const MAX_STATE_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

class AppStateManager {
  /**
   * Save current app state
   */
  async saveState(): Promise<void> {
    try {
      const playerState = usePlayerStore.getState();
      const authState = useAuthStore.getState();

      const state: AppState = {
        player: {
          currentSongId: playerState.currentSong?.id || null,
          queue: playerState.queue.map((s) => s.id),
          volume: playerState.volume,
          shuffle: playerState.shuffle,
          repeat: playerState.repeat,
        },
        auth: {
          token: localStorage.getItem('token'),
          userId: authState.user?.id || null,
        },
        timestamp: Date.now(),
      };

      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save app state:', error);
    }
  }

  /**
   * Restore app state
   */
  async restoreState(): Promise<Partial<AppState> | null> {
    try {
      const stateJson = localStorage.getItem(STATE_KEY);
      if (!stateJson) return null;

      const state: AppState = JSON.parse(stateJson);

      // Check if state is too old
      const age = Date.now() - state.timestamp;
      if (age > MAX_STATE_AGE) {
        localStorage.removeItem(STATE_KEY);
        return null;
      }

      return state;
    } catch (error) {
      console.error('Failed to restore app state:', error);
      return null;
    }
  }

  /**
   * Clear saved state
   */
  clearState(): void {
    localStorage.removeItem(STATE_KEY);
  }

  /**
   * Initialize state persistence listeners
   */
  init(): void {
    if (!Capacitor.isNativePlatform()) return;

    // Save state when app goes to background
    App.addListener('appStateChange', async (state) => {
      if (state.isActive === false) {
        await this.saveState();
      }
    });

    // Save state periodically
    setInterval(() => {
      this.saveState();
    }, 30000); // Every 30 seconds

    // Restore state on app start
    this.restoreState().then((savedState) => {
      if (savedState) {
        // Restore player state if needed
        if (savedState.player) {
          const playerStore = usePlayerStore.getState();
          // Only restore if no current song is playing
          if (!playerStore.currentSong && savedState.player.currentSongId) {
            // Queue will be restored from backend, but we can set preferences
            usePlayerStore.setState({
              volume: savedState.player.volume,
              shuffle: savedState.player.shuffle,
              repeat: savedState.player.repeat,
            });
          }
        }
      }
    });
  }
}

export const appStateManager = new AppStateManager();
