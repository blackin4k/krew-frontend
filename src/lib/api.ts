import axios from 'axios';
import { usePlayerStore } from "@/stores/playerStore";
import { toast } from "sonner";
import { createRetryableRequest } from "./retryHandler";
import { offlineCache } from "./offlineCache";


// Production API URL
const API_URL = 'https://api.kreewaux.xyz';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 second timeout
  // withCredentials removed to simplify CORS (we use Bearer tokens)
});

// Add token and ngrok bypass header to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Bypass ngrok browser warning page
  config.headers['ngrok-skip-browser-warning'] = 'true';
  return config;
});

// Response interceptor for 401 and connection error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Determine if this is a network/connectivity error
    const isNetworkError = !error.response && error.code !== 'ECONNABORTED';

    if (isNetworkError) {
      // Notify the user gently
      toast.error('Network error. Checking connection...', {
        duration: 3000
      });
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/auth';
    }

    // For retryable errors, use retry handler
    if (isNetworkError || [408, 429, 500, 502, 503, 504].includes(error.response?.status)) {
      // The retry will be handled by the calling code using createRetryableRequest
    }

    return Promise.reject(error);
  }
);

// Helper to wrap API calls with retry logic
export function apiCall<T>(fn: () => Promise<T>, retry = true): Promise<T> {
  if (retry) {
    return createRetryableRequest(fn, {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
    });
  }
  return fn();
}

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  register: (username: string, email: string, password: string) =>
    api.post('/auth/register', { username, email, password }),
  me: () => api.get('/me'),
};

// System
export const systemApi = {
  health: () => api.get('/health'),
};

// Songs
export const songsApi = {
  getAll: (page = 1, limit = 30, sort?: string) =>
    api.get(`/songs?page=${page}&limit=${limit}${sort ? `&sort=${sort}` : ''}`),
  search: (q: string, genre?: string, sort?: string, config?: import('axios').AxiosRequestConfig) =>
    api.get('/search', { params: { q, genre, sort }, ...config }),
  getTrending: () => api.get('/search/trending'),
  stream: (id: number) => `${API_URL}/songs/${id}/stream`,
  like: (id: number) => api.post(`/songs/${id}/like`),
  unlike: (id: number) => api.post(`/songs/${id}/unlike`),
  isLiked: (id: number) => api.get(`/songs/${id}/liked`),
  get: (id: number) => api.get(`/songs/${id}`),
  logPlay: (id: number, duration: number) => api.post(`/songs/${id}/played`, { duration }),
};

// Player
export const playerApi = {
  play: (songId: number) => api.post('/player/play', { song_id: songId }),
  next: () => api.post('/player/next'),
  prev: () => api.post('/player/prev'),
  shuffle: (enabled: boolean) => api.post('/player/shuffle', { enabled }),
  repeat: (mode: 'off' | 'all' | 'one') => api.post('/player/repeat', { mode }),
  state: () => api.get('/player/state'),
  queue: () => api.get('/player/queue'),
  addToQueue: (songId: number) => api.post('/player/queue/add', { song_id: songId }),
  modifyQueue: (action: string, data: Record<string, unknown>) =>
    api.post('/player/queue/modify', { action, ...data }),
  getHistory: () => api.get('/player/history'),
  smartShuffle: () => api.post('/player/smart-shuffle'),
  recordPlay: (songId: number) => api.post('/player/record-play', { song_id: songId }),
};

// Library
export const libraryApi = {
  getLiked: () => api.get('/me/library'),
  getRecent: () => api.get('/me/recent'),
  getRecommendations: () => api.get('/recommendations'),
  getDuplicates: () => api.get('/library/duplicates'),
  getStreak: () => api.get('/me/streak'),
};

// Playlists
export const playlistsApi = {
  getAll: () => api.get('/playlists'),
  get: (id: number) => api.get(`/playlists/${id}`),
  create: (name: string) => api.post('/playlists', { name }),
  delete: (id: number) => api.delete(`/playlists/${id}`),
  addSong: (playlistId: number, songId: number) =>
    api.post(`/playlists/${playlistId}/add`, { song_id: songId }),
  removeSong: (playlistId: number, songId: number) =>
    api.post(`/playlists/${playlistId}/remove`, { song_id: songId }),
  reorder: (playlistId: number, songIds: number[]) =>
    api.post(`/playlists/${playlistId}/reorder`, { song_ids: songIds }),
  play: (id: number) => api.post(`/playlists/${id}/play`),
  update: (id: number, name: string) => api.put(`/playlists/${id}`, { name }),
  uploadCover: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('cover', file);
    return api.post(`/playlists/${id}/cover`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importSpotify: (url: string) => api.post('/playlists/import/spotify', { url }),
  merge: (playlistIds: number[], name: string) => api.post('/playlists/merge', { playlist_ids: playlistIds, name }),
};





// Browse
export const browseApi = {
  genres: () => api.get('/browse/genres'),
  genreSongs: (genre: string) => api.get(`/browse/genres/${genre}`),
  albums: () => api.get('/albums'),
  albumSongs: (name: string) => api.get(`/albums/${name}`),
  artists: () => api.get('/artists'),
  artist: (name: string) => api.get(`/artists/${name}`),
};

// Radio
export const radioApi = {
  song: (id: number) => api.get(`/radio/song/${id}`),
  artist: (name: string) => api.get(`/radio/artist/${name}`),
  album: (name: string) => api.get(`/radio/album/${name}`),
  becauseYouListened: (id: number) => api.get(`/because/${id}`),
};

// Upload
export const uploadApi = {
  song: (formData: FormData) =>
    api.post('/songs/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// Artist Verification
export const artistApi = {
  apply: (data: { artist_name: string; bio: string; social_links?: string; sample_work_url?: string }) =>
    api.post('/artist/apply', data),
  getStatus: () => api.get('/artist/status'),
  // Admin endpoints
  getApplications: () => api.get('/admin/artist-applications'),
  approve: (appId: number) => api.post(`/admin/artist-applications/${appId}/approve`),
  reject: (appId: number) => api.post(`/admin/artist-applications/${appId}/reject`),
};


// Capsule
export const capsuleApi = {
  getStats: () => api.get('/capsule/stats'),
};

// Jam sync (Socket.IO)
// Centralized server-authoritative playback handling
// This module only exposes helpers; actual socket wiring should call applyJamState on events.

export type JamStatePayload = {
  song_id: number
  base_position?: number // seconds (deprecated)
  position?: number      // seconds (preferred)
  started_at: string | null // ISO or null
  paused: boolean
  server_time: number // unix timestamp in ms
};

// Consumers should provide a resolver that returns the HTMLAudioElement for jam playback
let getAudioElement: (() => HTMLAudioElement | null) | null = null;
// Consumers should provide a resolver that maps song_id to an audio src url
let getSongSrc: ((songId: number) => string) | null = null;

export function configureJamPlayback(opts: {
  getAudio: () => HTMLAudioElement | null
  getSrcForSong: (songId: number) => string
}) {
  getAudioElement = opts.getAudio;
  getSongSrc = opts.getSrcForSong;
}

function safeNumber(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!isFinite(v) || isNaN(v)) return 0;
  return v;
}

function computeServerPosition(payload: JamStatePayload): number {
  // vivid: support both position (new) and base_position (old)
  const rawPos = payload.position ?? payload.base_position;
  const base = Math.max(0, safeNumber(rawPos));

  if (payload.paused || !payload.started_at) return base;

  const nowClientSec = Date.now() / 1000; // ✅ convert to seconds
  const serverTimeSec = safeNumber(payload.server_time);

  if (!isFinite(serverTimeSec) || isNaN(serverTimeSec)) return base;

  const delta = nowClientSec - serverTimeSec;
  return Math.max(0, base + delta);
}


const DRIFT_HARD_SEEK_THRESHOLD = 0.2; // seconds

function ensureSongSrc(audio: HTMLAudioElement, songId: number) {
  if (!getSongSrc) return;

  const targetSrc = getSongSrc(songId);
  if (!targetSrc) return;

  if (audio.src !== targetSrc) {
    audio.src = targetSrc;
  }
}

function hardSeek(audio: HTMLAudioElement, position: number) {
  const clamped = Math.max(0, position);
  if (!isFinite(clamped) || isNaN(clamped)) return;
  try {
    audio.currentTime = clamped;
  } catch (_) {
    // ignore
  }
}

export function applyJamState(payload: JamStatePayload, opts?: { reason?: 'play' | 'sync' | 'seek' | 'pause' | 'heartbeat' }) {
  if (!getAudioElement || !getSongSrc) return;
  const audio = getAudioElement();
  if (!audio) return;

  // Skip if no song_id (jam has no song playing yet)
  if (!payload.song_id) {
    // console.log('[Jam] No song_id in payload, skipping');
    return;
  }

  // Signal that we are applying a remote update
  usePlayerStore.setState({ isRemoteUpdate: true });
  // Reset after enough time for events (seeking/play/pause) to fire and be ignored
  setTimeout(() => usePlayerStore.setState({ isRemoteUpdate: false }), 500);

  const serverPosition = computeServerPosition(payload);

  // DEBUG LOGGING
  // DEBUG LOGGING removed

  // Playback control rules
  if (payload.paused) {
    // CRITICAL: Flag as remote update BEFORE pausing to prevent JamManager re-broadcast
    usePlayerStore.setState({ isRemoteUpdate: true, isPlaying: false });

    // paused: ensure src, pause and hard set position
    ensureSongSrc(audio, payload.song_id);

    // Force pause immediately
    audio.pause();

    // Explicitly set currentTime after pause to ensure frame sticks
    hardSeek(audio, serverPosition);

    // Fetch song metadata so UI can display the song info
    const store = usePlayerStore.getState();
    const currentId = store.currentSong ? Number(store.currentSong.id) : null;
    const targetId = Number(payload.song_id);

    if (currentId !== targetId) {
      // Set placeholder immediately
      usePlayerStore.setState({
        currentSong: {
          id: payload.song_id,
          title: "Loading...",
          artist: "Jam Sync"
        } as any
      });

      api.get(`/songs/${payload.song_id}`).then(res => {
        const latestId = Number(usePlayerStore.getState().currentSong?.id);
        if (Number(res.data.id) === latestId) {
          usePlayerStore.setState({ currentSong: res.data });
        }
      }).catch(err => {
        console.error("Failed to fetch jam song", err);
      });
    }

    // Clear flag after enough time for React effects to run
    setTimeout(() => usePlayerStore.setState({ isRemoteUpdate: false }), 200);
    return;
  }

  // Not paused: ensure src first
  ensureSongSrc(audio, payload.song_id);

  // CRITICAL FIX: If we don't have the song or it's different, we MUST fetch it 
  // so the Player UI can render (it needs title, artist, cover).
  const store = usePlayerStore.getState();
  const currentId = store.currentSong ? Number(store.currentSong.id) : null;
  const targetId = Number(payload.song_id);

  if (currentId !== targetId) {
    // Set placeholder immediately so mini player shows
    usePlayerStore.setState({
      currentSong: {
        id: payload.song_id,
        title: "Loading...",
        artist: "Jam Sync"
      } as any
    });

    // Then fetch real metadata
    const songUrl = `/songs/${payload.song_id}`;
    // console.log(`[Jam] Fetching song metadata from: ${songUrl}`);

    api.get(songUrl).then(res => {
      // console.log(`[Jam] Song metadata received:`, res.data);
      // Double check we are still trying to play this song (avoid race condition)
      const latestId = Number(usePlayerStore.getState().currentSong?.id);
      if (Number(res.data.id) === latestId) {
        usePlayerStore.setState({ currentSong: res.data });
      }
    }).catch(err => {
      console.error("Failed to fetch jam song", err);
      toast.error(`Song info failed: ${err.message || 'Network error'}`);
      // Set error state in song title
      usePlayerStore.setState({
        currentSong: {
          id: payload.song_id,
          title: "Unknown Song",
          artist: "Jam"
        } as any
      });
    });
  }

  // For initial sync and general updates, correct before play
  const drift = Math.abs((audio.currentTime || 0) - serverPosition);

  // Late join handling: initial sync should always hard seek
  if (opts?.reason === 'sync') {
    hardSeek(audio, serverPosition);
  } else if (opts?.reason === 'heartbeat') {
    // Drift correction on heartbeat
    if (drift > DRIFT_HARD_SEEK_THRESHOLD) {
      hardSeek(audio, serverPosition);
    }
  } else {
    // For play/seek events: seek when drift is meaningful
    if (drift > DRIFT_HARD_SEEK_THRESHOLD) {
      hardSeek(audio, serverPosition);
    }
  }

  // Ensure playing only after position is corrected
  // Do not restart if same song is already playing and within threshold
  const shouldBePlaying = !payload.paused;
  if (shouldBePlaying) {
    // CRITICAL: Flag as remote update BEFORE playing to prevent JamManager re-broadcast
    usePlayerStore.setState({ isRemoteUpdate: true, isPlaying: true });

    // If audio is paused, attempt to play
    if (audio.paused) {
      void audio.play().catch((err) => {
        console.error("Jam Play Error:", err);
        toast.error(`Jam Play Blocked: ${err.message}`);
      });
    }

    // Clear flag after enough time for React effects to run
    setTimeout(() => usePlayerStore.setState({ isRemoteUpdate: false }), 200);
  }
}

// Socket event helpers that centralize to applyJamState
export const jamSocketHandlers = {
  onPlay: (payload: JamStatePayload) => applyJamState(payload, { reason: 'play' }),
  onSync: (payload: JamStatePayload) => applyJamState(payload, { reason: 'sync' }),
  onSeek: (payload: JamStatePayload) => applyJamState(payload, { reason: 'seek' }),
  onPause: (payload: JamStatePayload) => applyJamState(payload, { reason: 'pause' }),
  onHeartbeat: (payload: JamStatePayload) => applyJamState(payload, { reason: 'heartbeat' }),
};

export { API_URL };

export default api;
