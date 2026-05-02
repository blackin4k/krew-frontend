import { create } from 'zustand';
import { playerApi, radioApi, songsApi, API_URL } from '@/lib/api';
import { normalizeQueueResponse } from '@/lib/queue';
import { toast } from 'sonner';
import { useOfflineStore } from './offlineStore';

export interface Song {
  id: number;
  title: string;
  artist: string;
  album?: string;
  cover?: string;
  audio?: string;
  genre?: string;
  duration?: number;
  bpm?: number;
}

type PerformanceMode = 'full' | 'lite';

interface PlayerState {
  currentSong: Song | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  queue: Song[];
  audio: HTMLAudioElement | null; // Legacy ref (points to active)
  analyser: AnalyserNode | null;
  isExpanded: boolean;
  sleepTimerEnd: number | null;
  lyrics: string | null;
  showLyrics: boolean;
  setShowLyrics: (show: boolean) => void;
  showDashboard: boolean;
  setShowDashboard: (show: boolean) => void;
  lastPlayStart: number;
  isRemoteUpdate: boolean; // Flag to suppress socket broadcast during sync
  isLoadingNext: boolean; // Flag to prevent "paused" state during transition
  performanceMode: PerformanceMode;
  setPerformanceMode: (mode: PerformanceMode) => void;


  // Visualizer
  visualizerColor: string | null;
  setVisualizerColor: (color: string | null) => void;
  attachVisualizer: () => void;
  detachVisualizer: () => void;

  // Segment Looper
  loopStartTime: number;
  loopEndTime: number;
  loopSegmentEnabled: boolean;
  setLoopStartTime: (time: number) => void;
  setLoopEndTime: (time: number) => void;
  setLoopSegmentEnabled: (enabled: boolean) => void;

  // Lab (EQ & FX)
  eqGains: number[];
  vinylMode: boolean;
  setEqBand: (index: number, gain: number) => void;
  setVinylMode: (enabled: boolean) => void;
  // AI DJ
  aiDjMode: boolean;
  setAiDjMode: (enabled: boolean) => void;

  // Crossfade
  crossfadeEnabled: boolean;
  setCrossfadeEnabled: (enabled: boolean) => void;
  crossfadeDuration: number;
  setCrossfadeDuration: (duration: number) => void;

  // Internal Dual-Audio State
  _audioA: HTMLAudioElement | null;
  _audioB: HTMLAudioElement | null;
  _gainA: GainNode | null;
  _gainB: GainNode | null;
  _activeAudio: 'A' | 'B';
  _isCrossfading: boolean;
  _audioCtx: AudioContext | null;
  _analyserNode: AnalyserNode | null;
  _analyserAttached: boolean;
  _visualizerConsumers: number;
  _sourceA: MediaElementAudioSourceNode | null;
  _sourceB: MediaElementAudioSourceNode | null;
  _audioEventsCleanupA: (() => void) | null;
  _audioEventsCleanupB: (() => void) | null;
  _eqNodes: BiquadFilterNode[];
  _vinylNode: BiquadFilterNode | null;
  _vinylNoiseNode: AudioBufferSourceNode | null;
  _vinylNoiseGain: GainNode | null;

  // FX Nodes

  _delayNode: DelayNode | null;
  _delayFeedbackNode: GainNode | null;
  _convolverNode: ConvolverNode | null;
  _reverbGainNode: GainNode | null;

  // FX State
  fxReverbWet: number;
  fxDelayTime: number;
  fxDelayFeedback: number;


  setFxReverb: (wet: number) => void;
  setFxDelay: (time: number, feedback: number) => void;


  // Actions
  toggleExpanded: () => void;
  setExpanded: (expanded: boolean) => void;
  initAudio: () => void;
  playSong: (song: Song) => Promise<void>;
  playCollection: (songs: Song[], startIndex?: number) => Promise<void>;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  toggleShuffle: () => Promise<void>;
  toggleRepeat: () => Promise<void>;
  addToQueue: (song: Song) => void;
  loadQueue: () => Promise<void>;
  setSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
  fetchLyrics: () => Promise<void>;

  recordPlay: () => Promise<void>;
  playRadio: (seedSongId: number) => Promise<void>;
  reset: () => void;
  _handleCrossfadeAuto: () => Promise<void>;
  _sleepTimeout: NodeJS.Timeout | null;
  updateMediaSession: () => void;
  _logDuration: () => void;
  cleanupAudio: () => void;

  // Kill limit
  _idleTimeout: NodeJS.Timeout | null;
  setIdleTimeout: () => void;
  clearIdleTimeout: () => void;
}

const FULL_PROGRESS_UPDATE_INTERVAL_MS = 250;
const LITE_PROGRESS_UPDATE_INTERVAL_MS = 400;
const PROGRESS_EPSILON = 0.05;
const DURATION_EPSILON = 0.25;
const START_PLAY_DELAY_MS = 24;
const START_GAIN_RAMP_SECONDS = 0.05;
const MOBILE_ANALYSER_FFT_SIZE = 64;
const DESKTOP_ANALYSER_FFT_SIZE = 256;

const isMobilePlaybackEnvironment = () => {
  if (typeof window === 'undefined') {
    return Capacitor.isNativePlatform();
  }

  return Capacitor.isNativePlatform() || window.innerWidth < 768;
};

const detectPerformanceMode = (): PerformanceMode => {
  if (typeof window === 'undefined') {
    return Capacitor.isNativePlatform() ? 'lite' : 'full';
  }

  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };

  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const lowCoreCount = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4;
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const saveData = !!nav.connection?.saveData;

  return reducedMotion || lowCoreCount || lowMemory || saveData
    ? 'lite'
    : 'full';
};

const getProgressUpdateInterval = (mode: PerformanceMode) =>
  mode === 'lite' ? LITE_PROGRESS_UPDATE_INTERVAL_MS : FULL_PROGRESS_UPDATE_INTERVAL_MS;

const setIfChanged = (
  state: PlayerState,
  setState: (partial: Partial<PlayerState>) => void,
  partial: Partial<PlayerState>,
) => {
  const nextState: Partial<PlayerState> = {};
  let hasChanges = false;

  for (const key of Object.keys(partial) as Array<keyof PlayerState>) {
    const nextValue = partial[key];
    if (!Object.is(state[key], nextValue)) {
      nextState[key] = nextValue as never;
      hasChanges = true;
    }
  }

  if (hasChanges) {
    setState(nextState);
  }

  return hasChanges;
};

const areQueuesEqual = (left: Song[], right: Song[]) => {
  if (left.length !== right.length) return false;
  return left.every((song, index) => song.id === right[index]?.id);
};

const areNumberArraysEqual = (left: number[], right: number[]) => {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const rampGainIn = (gain: GainNode | null, ctx: AudioContext) => {
  if (!gain) return;
  const now = ctx.currentTime;
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + START_GAIN_RAMP_SECONDS);
};

const syncAnalyserRouting = (
  state: PlayerState,
  setState: (partial: Partial<PlayerState>) => void,
) => {
  const {
    _audioCtx,
    _gainA,
    _gainB,
    _analyserNode,
    _visualizerConsumers,
    _analyserAttached,
    analyser,
  } = state;

  if (!_audioCtx || !_gainA || !_gainB) return;

  const shouldUseAnalyser = !!_analyserNode && _visualizerConsumers > 0;

  try { _gainA.disconnect(); } catch {}
  try { _gainB.disconnect(); } catch {}
  try { _analyserNode?.disconnect(); } catch {}

  _gainA.connect(_audioCtx.destination);
  _gainB.connect(_audioCtx.destination);

  if (shouldUseAnalyser && _analyserNode) {
    _gainA.connect(_analyserNode);
    _gainB.connect(_analyserNode);
  }

  setIfChanged(state, setState, {
    analyser: shouldUseAnalyser ? _analyserNode : null,
    _analyserAttached: shouldUseAnalyser,
  });
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  isPlaying: false,
  volume: 0.7,
  progress: 0,
  duration: 0,
  shuffle: false,
  repeat: 'off',
  queue: [],
  audio: null,
  analyser: null,
  isExpanded: false,
  sleepTimerEnd: null,
  lyrics: null,
  showLyrics: false,
  showDashboard: false,
  setShowDashboard: (show) => setIfChanged(get(), set, { showDashboard: show }),
  lastPlayStart: 0,
  isRemoteUpdate: false,
  isLoadingNext: false,
  performanceMode: detectPerformanceMode(),
  setPerformanceMode: (mode) => {
    const state = get();
    if (state.performanceMode === mode) return;

    if (state._analyserNode) {
      state._analyserNode.fftSize = mode === 'lite' ? MOBILE_ANALYSER_FFT_SIZE : DESKTOP_ANALYSER_FFT_SIZE;
    }

    setIfChanged(state, set, {
      performanceMode: mode,
      crossfadeEnabled: mode === 'lite' ? false : state.crossfadeEnabled,
    });
  },

  loopStartTime: 0,
  loopEndTime: 0,
  loopSegmentEnabled: false,
  setLoopStartTime: (loopStartTime) => setIfChanged(get(), set, { loopStartTime }),
  setLoopEndTime: (loopEndTime) => setIfChanged(get(), set, { loopEndTime }),
  setLoopSegmentEnabled: (loopSegmentEnabled) => setIfChanged(get(), set, { loopSegmentEnabled }),

  visualizerColor: null,
  attachVisualizer: () => {
    const state = get();

    // If audio pipeline hasn't been initialized yet, do it now.
    // This handles the case where Visualizer mounts before Player calls initAudio().
    if (!state._audioCtx || state._audioCtx.state === 'closed') {
      get().initAudio();
    }

    const nextConsumers = get()._visualizerConsumers + 1;
    setIfChanged(get(), set, { _visualizerConsumers: nextConsumers });

    // Resume AudioContext if it was suspended (common on Capacitor/Android WebView
    // after cleanupAudio suspends the context during idle)
    const ctx = get()._audioCtx;
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(console.warn);
    }

    syncAnalyserRouting({ ...get(), _visualizerConsumers: nextConsumers }, set);
  },
  detachVisualizer: () => {
    const state = get();
    const nextConsumers = Math.max(0, state._visualizerConsumers - 1);
    if (nextConsumers === state._visualizerConsumers) return;
    setIfChanged(state, set, { _visualizerConsumers: nextConsumers });
    syncAnalyserRouting({ ...get(), _visualizerConsumers: nextConsumers }, set);
  },
  eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  vinylMode: false,
  aiDjMode: false,
  crossfadeEnabled: false,
  crossfadeDuration: 6,

  _audioA: null,
  _audioB: null,
  _gainA: null,
  _gainB: null,
  _sleepTimeout: null,
  _idleTimeout: null,
  setIdleTimeout: () => {
    const { clearIdleTimeout, pause, cleanupAudio } = get();
    clearIdleTimeout();
    // 5 minutes
    const timeout = setTimeout(() => {
      pause();
      if (Capacitor.isNativePlatform() && !get().isPlaying) {
        //do nothing twian useless piceofcode 
      }
      cleanupAudio();
    }, 300000);
    setIfChanged(get(), set, { _idleTimeout: timeout });
  },
  clearIdleTimeout: () => {
    const state = get();
    const { _idleTimeout } = state;
    if (_idleTimeout) clearTimeout(_idleTimeout);
    setIfChanged(state, set, { _idleTimeout: null });
  },
  _activeAudio: 'A',
  _isCrossfading: false,
  _audioCtx: null,
  _analyserNode: null,
  _analyserAttached: false,
  _visualizerConsumers: 0,
  _sourceA: null,
  _sourceB: null,
  _audioEventsCleanupA: null,
  _audioEventsCleanupB: null,
  _eqNodes: [],
  _vinylNode: null,
  _vinylNoiseNode: null,
  _vinylNoiseGain: null,

  // FX Nodes Init

  _delayNode: null,
  _delayFeedbackNode: null,
  _convolverNode: null,
  _reverbGainNode: null,

  fxReverbWet: 0,
  fxDelayTime: 0,
  fxDelayFeedback: 0,


  setFxReverb: (wet) => {
    setIfChanged(get(), set, { fxReverbWet: wet });
    const { _reverbGainNode } = get();
    if (_reverbGainNode) _reverbGainNode.gain.value = wet;
  },

  setFxDelay: (time, feedback) => {
    setIfChanged(get(), set, { fxDelayTime: time, fxDelayFeedback: feedback });
    const { _delayNode, _delayFeedbackNode } = get();
    if (_delayNode) _delayNode.delayTime.value = time;
    if (_delayFeedbackNode) _delayFeedbackNode.gain.value = feedback;
  },

  _logDuration: () => {
    const { currentSong, lastPlayStart } = get();
    if (currentSong && lastPlayStart > 0) {
      const duration = Math.round((Date.now() - lastPlayStart) / 1000);
      if (duration > 2) {
        songsApi.logPlay(currentSong.id, duration).catch(err => console.error("Log play failed", err));
      }
    }
  },

  toggleExpanded: () => set((state) => ({ isExpanded: !state.isExpanded })),
  setExpanded: (expanded: boolean) => setIfChanged(get(), set, { isExpanded: expanded }),

  // Cleanup Action
  cleanupAudio: () => {
    const state = get();
    const { _audioA, _audioB, _audioCtx } = state;

    // Stop all nodes
    _audioA?.pause();
    _audioB?.pause();

    // Remove listeners (Garbage Collection)
    _audioA?.removeAttribute('src');
    _audioB?.removeAttribute('src');
    _audioA?.load();
    _audioB?.load();

    // Suspend AudioContext to release hardware on Android without permanently
    // destroying the nodes (close() would invalidate gainA/gainB and break
    // playSong which reuses those nodes without calling initAudio again).
    if (_audioCtx && _audioCtx.state !== 'closed') {
      _audioCtx.suspend().catch(console.error);
    }

    setIfChanged(state, set, {
      audio: null,
      progress: 0,
      duration: 0,
      analyser: null,
      _analyserAttached: false,
      isPlaying: false,
      lastPlayStart: 0,
      isLoadingNext: false,
      _isCrossfading: false,
      lyrics: null,
      loopStartTime: 0,
      loopEndTime: 0,
      showLyrics: false,
      showDashboard: false,
      _idleTimeout: null,
      _sleepTimeout: state._sleepTimeout,
      crossfadeEnabled: state.crossfadeEnabled,
      _activeAudio: 'A',
    });
  },

  initAudio: () => {
    const state = get();
    const existing = state._audioCtx;

    if (typeof window === 'undefined') {
      return;
    }

    const detectedMode = detectPerformanceMode();
    if (state.performanceMode !== detectedMode) {
      get().setPerformanceMode(detectedMode);
    }

    if (
      existing
      && existing.state !== 'closed'
      && state._audioA
      && state._audioB
      && state._gainA
      && state._gainB
      && state._analyserNode
    ) {
      syncAnalyserRouting(get(), set);
      return;
    }

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();

    const createAudioNode = () => {
      const audio = new Audio();
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audio.volume = get().volume;
      return audio;
    };

    const audioA = createAudioNode();
    const audioB = createAudioNode();
    const gainA = ctx.createGain();
    const gainB = ctx.createGain();
    gainA.gain.value = 1;
    gainB.gain.value = 0;

    // Connect gains to destination immediately — audio MUST always reach the
    // speaker regardless of whether the Visualizer is mounted.
    // syncAnalyserRouting will reconnect them (with analyser tap if needed)
    // but having this here ensures audio works even if routing is skipped.
    gainA.connect(ctx.destination);
    gainB.connect(ctx.destination);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = get().performanceMode === 'lite' ? MOBILE_ANALYSER_FFT_SIZE : DESKTOP_ANALYSER_FFT_SIZE;
    analyser.smoothingTimeConstant = 0.75;

    const setupSource = (audio: HTMLAudioElement, gain: GainNode) => {
      const source = ctx.createMediaElementSource(audio);
      source.connect(gain);
      return source;
    };

    const sourceA = setupSource(audioA, gainA);
    const sourceB = setupSource(audioB, gainB);

    const setupEvents = (audio: HTMLAudioElement) => {
      audio.onended = null;
      audio.ontimeupdate = null;
      audio.onplay = null;
      audio.onpause = null;
      let lastProgressUpdateAt = 0;
      let lastPublishedProgress = 0;
      let lastPublishedDuration = 0;

      const handleTimeUpdate = () => {
        const state = get();
        const isActiveAudio =
          (state._audioA === audio && state._activeAudio === 'A')
          || (state._audioB === audio && state._activeAudio === 'B');

        if (!isActiveAudio) return;

        let nextProgress = audio.currentTime;
        const duration = Math.max(0, audio.duration || 0);

        if (state.loopSegmentEnabled && state.loopEndTime > 0 && nextProgress >= state.loopEndTime) {
          audio.currentTime = state.loopStartTime;
          if (!audio.paused) audio.play();
          nextProgress = audio.currentTime;
        }

        const now = performance.now();
        const updateInterval = getProgressUpdateInterval(state.performanceMode);
        const progressChanged = Math.abs(state.progress - nextProgress) >= PROGRESS_EPSILON;
        const durationChanged = Math.abs(state.duration - duration) >= DURATION_EPSILON;
        const shouldPublishProgress =
          progressChanged
          && (
            now - lastProgressUpdateAt >= updateInterval
            || nextProgress < lastPublishedProgress
            || Math.abs(nextProgress - lastPublishedProgress) >= 1
          );

        if (shouldPublishProgress || durationChanged) {
          const nextState: Partial<PlayerState> = {};

          if (shouldPublishProgress) {
            nextState.progress = nextProgress;
            lastProgressUpdateAt = now;
            lastPublishedProgress = nextProgress;
          }

          if (durationChanged) {
            nextState.duration = duration;
            lastPublishedDuration = duration;
          }

          if (Object.keys(nextState).length > 0) {
            setIfChanged(state, set, nextState);
          }
        } else if (duration > 0 && Math.abs(lastPublishedDuration - duration) >= DURATION_EPSILON) {
          lastPublishedDuration = duration;
        }

        const timeLeft = duration - nextProgress;
        if (
          !state.loopSegmentEnabled
          && state.crossfadeEnabled
          && state.crossfadeDuration > 0
          && timeLeft > 0
          && timeLeft <= state.crossfadeDuration
          && !state._isCrossfading
          && state.queue.length > 0
        ) {
          get()._handleCrossfadeAuto();
        }
      };

      const handleEnded = () => {
        if (get()._isCrossfading) return;
        if (get().repeat === 'one') {
          get().recordPlay();
          audio.currentTime = 0;
          audio.play();
          return;
        }

        setIfChanged(get(), set, { isLoadingNext: true });
        get().next();
      };

      const handlePlay = async () => {
        if (ctx.state === 'suspended') {
          try {
            await ctx.resume();
          } catch (error) {
            console.warn('ctx.resume() in play handler failed', error);
          }
        }

        setIfChanged(get(), set, { isPlaying: true, lastPlayStart: Date.now() });
        get().clearIdleTimeout();
      };

      const handleError = (event: Event) => {
        const error = (event.target as HTMLAudioElement).error;
        const message = error ? `Code: ${error.code} (${error.message})` : 'Unknown playback error';
        console.error('Audio Playback Error:', message, audio.src);
        toast.error(`Audio Error: ${message}`);

        if (get().isPlaying && !get().isLoadingNext) {
          get().next();
        }
      };

      const handlePause = () => {
        get()._logDuration();
        setIfChanged(get(), set, { lastPlayStart: 0 });
        if (!get()._isCrossfading && !get().isLoadingNext) {
          setIfChanged(get(), set, { isPlaying: false });
          get().setIdleTimeout();
        }
      };

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('error', handleError);
      audio.addEventListener('pause', handlePause);

      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('error', handleError);
        audio.removeEventListener('pause', handlePause);
      };
    };

    state._audioEventsCleanupA?.();
    state._audioEventsCleanupB?.();

    const cleanupAudioAEvents = setupEvents(audioA);
    const cleanupAudioBEvents = setupEvents(audioB);

    set({
      audio: audioA,
      analyser: null,
      _audioA: audioA,
      _audioB: audioB,
      _gainA: gainA,
      _gainB: gainB,
      _audioCtx: ctx,
      _analyserNode: analyser,
      _analyserAttached: false,
      _activeAudio: 'A',
      _sourceA: sourceA,
      _sourceB: sourceB,
      _audioEventsCleanupA: cleanupAudioAEvents,
      _audioEventsCleanupB: cleanupAudioBEvents,
      _eqNodes: [],
      _vinylNode: null,
      _vinylNoiseNode: null,
      _vinylNoiseGain: null,
      _delayNode: null,
      _delayFeedbackNode: null,
      _convolverNode: null,
      _reverbGainNode: null
    });

    // Always run routing after initializing the audio graph.
    // syncAnalyserRouting handles both cases internally:
    //   - consumers = 0 → gains connect to destination only (no analyser tap)
    //   - consumers > 0 → gains connect to destination + analyser tap
    // Previously this was guarded by `if (consumers > 0)` which skipped
    // destination routing entirely and silenced audio on fresh init.
    syncAnalyserRouting(get(), set);
  },

  playSong: async (song: Song) => {
    get()._logDuration(); // Log previous song if any
    setIfChanged(get(), set, { lastPlayStart: 0 });
    get().recordPlay();

    // FIX #4: initAudio() is synchronous but Zustand's set() may not have flushed.
    // Awaiting a single JS tick ensures _audioCtx is visible in the next get() call.
    if (!get()._audioA) {
      get().initAudio();
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const state = get();
    const ctx = state._audioCtx;
    if (!ctx) {
      console.error("[playSong] AudioContext unavailable after init");
      toast.error("Audio engine failed. Tap again to retry.");
      return;
    }

    // BUG 3 FIX: Do NOT clear isLoadingNext here — next() sets it before calling
    // playSong, and we must keep it true until audio.play() resolves so the pause
    // handler doesn't set isPlaying=false and kill the foreground service.
    setIfChanged(state, set, { _isCrossfading: false });
    const active = state._activeAudio;
    const audio = active === 'A' ? state._audioA : state._audioB;
    const oppositeAudio = active === 'A' ? state._audioB : state._audioA;
    const activeGain = active === 'A' ? state._gainA : state._gainB;
    const oppositeGain = active === 'A' ? state._gainB : state._gainA;

    if (!audio || !oppositeAudio) {
      console.error("Audio initialization failed: Missing nodes", { audio, activeGain });
      toast.error("Audio engine failed to initialize. Please restart the app.");
      return;
    }

    try {
      // Resolve downloaded version if exists
      const { downloadedSongs } = useOfflineStore.getState();
      const downloadedVersion = downloadedSongs.find(s => s.id === song.id);

      const offlineSong = (downloadedVersion || song) as any;
      const existingAudio = typeof song.audio === 'string' ? song.audio : '';
      const existingCover = typeof song.cover === 'string' ? song.cover : '';
      let data = { audio: existingAudio, cover: existingCover };
      
      // Fire-and-forget background sync
      const syncPromise = playerApi.play(song.id).then((response) => ({
        audio: response.data?.audio ?? '',
        cover: response.data?.cover ?? '',
      })).catch(err => {
        console.error('Background playback sync failed:', err);
        return { audio: '', cover: '' };
      });

      if (!offlineSong.local) {
        if (!navigator.onLine && !existingAudio) {
            toast.error("You are offline. Play downloaded songs from your Offline Library.");
            setIfChanged(get(), set, { isPlaying: false, isLoadingNext: false });
            return;
        }

        // Only block if we have NO audio URL at all
        if (!existingAudio) {
          data = await syncPromise;
          if (!data.audio) {
            console.error("Missing audio URL after sync", song.id);
            toast.error("This song is unavailable right now");
            setIfChanged(get(), set, { isPlaying: false, isLoadingNext: false });
            return;
          }
        }
      }

      if (activeGain && oppositeGain) {
        activeGain.gain.cancelScheduledValues(ctx.currentTime);
        activeGain.gain.setValueAtTime(0, ctx.currentTime);
        activeGain.gain.linearRampToValueAtTime(1, ctx.currentTime + START_GAIN_RAMP_SECONDS);
        oppositeGain.gain.cancelScheduledValues(ctx.currentTime);
        oppositeGain.gain.setValueAtTime(0, ctx.currentTime);
      }

      audio.pause();
      oppositeAudio.pause();

      if (offlineSong.local && offlineSong.filePath) {
        audio.src = Capacitor.isNativePlatform()
          ? Capacitor.convertFileSrc(offlineSong.filePath)
          : offlineSong.filePath;
      } else {
        audio.src = data.audio;
      }

      audio.load();

      if (ctx.state !== 'running') {
        await ctx.resume();
      }

      await waitFor(START_PLAY_DELAY_MS);
      await audio.play();
      rampGainIn(activeGain, ctx);

      setIfChanged(get(), set, {
        currentSong: { ...song, cover: data.cover || existingCover, audio: data.audio || existingAudio },
        isPlaying: true,
        isLoadingNext: false,
        audio: audio,
        lyrics: null,
        loopStartTime: 0,
        loopEndTime: audio.duration || song.duration || 0
      });

      // Update store silently when sync completes if we used existing audio
      if (existingAudio) {
        syncPromise.then((synced) => {
          if (!synced.audio && !synced.cover) return;
          const currentStore = usePlayerStore.getState();
          if (currentStore.currentSong?.id !== song.id) return;

          set({
            currentSong: {
              ...currentStore.currentSong,
              audio: synced.audio || currentStore.currentSong.audio,
              cover: synced.cover || currentStore.currentSong.cover,
            },
          });
        });
      }

      // FIX #1 (BULLETPROOF): Never call MusicControls.create() with duration=0.
      // Strategy:
      //  a) If audio metadata is already loaded (readyState >= 1 = HAVE_METADATA), use it.
      //  b) Otherwise wait for 'loadedmetadata' with a 3s timeout fallback.
      //  c) If STILL 0 after metadata loads, fall back to song.duration from the API.
      //  d) Hard-minimum of 1 so Android MediaStyle never receives 0.
      // BUG 1 FIX: Don't call updateNativeControls until we have a REAL duration.
      // On Android, MusicControls.create() with duration=0 or 1 causes MediaStyle
      // to treat it as a radio stream — some Android versions crash MediaSessionCompat.
      // Strategy: wait for readyState >= 1 AND audio.duration > 0 before creating
      // the notification. If metadata never arrives, use song.duration from API.
      if (Capacitor.isNativePlatform()) {
        const waitForRealDuration = (): Promise<number> => {
          return new Promise((resolve) => {
            // Check if metadata already loaded with valid duration
            if (audio.readyState >= 1 && audio.duration > 0 && !isNaN(audio.duration)) {
              return resolve(audio.duration);
            }

            let resolved = false;
            const tryResolve = (d: number) => {
              if (resolved) return;
              resolved = true;
              audio.removeEventListener('loadedmetadata', onMeta);
              audio.removeEventListener('durationchange', onDuration);
              resolve(d);
            };

            const onMeta = () => {
              if (audio.duration > 0 && !isNaN(audio.duration)) {
                tryResolve(audio.duration);
              }
            };

            const onDuration = () => {
              if (audio.duration > 0 && !isNaN(audio.duration)) {
                tryResolve(audio.duration);
              }
            };

            audio.addEventListener('loadedmetadata', onMeta);
            audio.addEventListener('durationchange', onDuration);

            // Safety timeout: fall back to API duration, but NEVER use 0
            setTimeout(() => {
              if (!resolved) {
                const fallback = (song.duration && song.duration > 0) ? song.duration : 180;
                tryResolve(fallback);
              }
            }, 5000);
          });
        };

        waitForRealDuration().then((safeDuration) => {
          if (safeDuration <= 0 || isNaN(safeDuration)) safeDuration = 180; // absolute safety
          const liveState = usePlayerStore.getState();
          updateNativeControls({
            ...liveState,
            duration: safeDuration,
            progress: audio.currentTime || 0,
          }, true);
        });
      }

      // ALWAYS GET LYRCIS SO THAT DUMBASS PEOPLE WHO CANT WAIT , ITS READY FOR THEM 
      get().fetchLyrics();

      // DISPATCH JAM SYNC (IMPERATIVE)
      if (typeof window !== 'undefined') {
        // This bridges PlayerStore -> JamManager without circular deps
        window.dispatchEvent(new CustomEvent('krew:play', {
          detail: { songId: song.id, position: 0 }
        }));
      }

    } catch (e: any) {
      // Always clear loading state on any error path so the pause handler
      // isn't permanently locked out from setting isPlaying: false.
      setIfChanged(get(), set, { isLoadingNext: false });

      const isInterruption = e.message?.includes('interrupted by a new load request') || e.name === 'AbortError';
      if (isInterruption) {
        console.warn('Play interrupted by new load (harmless)');
        return;
      }
      console.error('Play failed', e);
      setIfChanged(get(), set, { isPlaying: false }); // safe to set false now — playback genuinely failed
      toast.error("Playback failed. Try another song.");
    }
  },

  playCollection: async (songs: Song[], startIndex = 0) => {
    if (!songs.length) return;

    const safeStartIndex = Math.min(Math.max(startIndex, 0), songs.length - 1);
    const current = songs[safeStartIndex];
    const remaining = songs.slice(safeStartIndex + 1);

    // Play first song immediately (non-blocking for backend if audio exists)
    await get().playSong(current);

    if (get().currentSong?.id !== current.id) {
      return;
    }

    // Update local queue immediately
    setIfChanged(get(), set, { queue: remaining });

    // Sync queue with backend in the background
    (async () => {
      try {
        await playerApi.modifyQueue('clear', {});
        for (const song of remaining) {
          await playerApi.addToQueue(song.id);
        }
      } catch (error) {
        console.error('Failed to sync queue with backend:', error);
      }
    })();
  },

  _handleCrossfadeAuto: async () => {
    if (get()._isCrossfading) return;

    const state = get();
    if (!state.crossfadeEnabled || state.crossfadeDuration <= 0) {
      return;
    }

    setIfChanged(state, set, { _isCrossfading: true });

    const duration = state.crossfadeDuration;
    const ctx = state._audioCtx;
    if (!ctx) {
      setIfChanged(get(), set, { _isCrossfading: false });
      return;
    }

    let nextSong: Song | null = null;
    try {
      const res = await playerApi.next();
      const payload = res.data;
      if (payload?.id) {
        nextSong = {
          id: payload.id,
          title: payload.title,
          artist: payload.artist,
          cover: payload.cover ?? null,
          audio: payload.audio ?? undefined,
        };

        const localQueueIndex = state.queue.findIndex((song) => song.id === payload.id);
        if (localQueueIndex >= 0) {
          const remainingQueue = [...state.queue];
          remainingQueue.splice(localQueueIndex, 1);
          setIfChanged(get(), set, { queue: remainingQueue });
        }
      }
    } catch (error) {
      console.error('Crossfade: next fetch failed', error);
      toast.error('Failed to load data');
    }

    if (!nextSong) {
      setIfChanged(get(), set, { _isCrossfading: false });
      return;
    }

    const incoming = state._activeAudio === 'A' ? 'B' : 'A';
    const outgoing = state._activeAudio;
    const incomingAudio = incoming === 'A' ? state._audioA : state._audioB;
    const outgoingAudio = outgoing === 'A' ? state._audioA : state._audioB;
    const incomingGain = incoming === 'A' ? state._gainA : state._gainB;
    const outgoingGain = outgoing === 'A' ? state._gainA : state._gainB;

    if (!incomingAudio || !outgoingAudio || !nextSong.audio) {
      if (!nextSong?.audio) {
        console.error('Missing audio for crossfade', nextSong?.id);
        toast.error('Next song failed to load');
      }
      setIfChanged(get(), set, { _isCrossfading: false });
      return;
    }

    incomingAudio.playbackRate = 1;
    incomingAudio.src = nextSong.audio;
    incomingAudio.load();
    if (incomingGain) incomingGain.gain.setValueAtTime(0, ctx.currentTime);

    try {
      await incomingAudio.play();
      const now = ctx.currentTime;
      const fadeEndTime = now + duration;

      if (outgoingGain) {
        outgoingGain.gain.cancelScheduledValues(now);
        outgoingGain.gain.setValueAtTime(1, now);
        outgoingGain.gain.linearRampToValueAtTime(0, fadeEndTime);
      }

      if (incomingGain) {
        incomingGain.gain.cancelScheduledValues(now);
        incomingGain.gain.setValueAtTime(0, now);
        incomingGain.gain.linearRampToValueAtTime(1, fadeEndTime);
      }

      setIfChanged(get(), set, { currentSong: nextSong, _activeAudio: incoming, audio: incomingAudio, lyrics: null });
      get().fetchLyrics();

      setTimeout(() => {
        outgoingAudio.pause();
        outgoingAudio.currentTime = 0;
        setIfChanged(get(), set, { _isCrossfading: false });
      }, duration * 1000);
    } catch (error) {
      console.error('Crossfade playback error', error);
      setIfChanged(get(), set, { _isCrossfading: false });
    }
  },

  togglePlay: () => {
    const { _activeAudio, _audioA, _audioB, _audioCtx, _gainA, _gainB, currentSong, playSong } = get();
    const audio = _activeAudio === 'A' ? _audioA : _audioB;
    const gain = _activeAudio === 'A' ? _gainA : _gainB;

    if (!audio || !audio.src) {
      console.warn("togglePlay: Audio element missing (page reload?), restarting song.");
      if (currentSong) {
        toast.info("Resuming session...");
        playSong(currentSong);
      }
      return;
    }

    const currentlyPlaying = !audio.paused && !audio.ended;

    if (currentlyPlaying) {
      audio.pause();
      setIfChanged(get(), set, { isPlaying: false, isLoadingNext: false, lastPlayStart: 0 });
      get().setIdleTimeout();
      return;
    }

    (async () => {
      try {
        if (_audioCtx?.state === 'suspended') {
          await _audioCtx.resume();
        }
        await waitFor(START_PLAY_DELAY_MS);
        await audio.play();
        if (_audioCtx) {
          rampGainIn(gain, _audioCtx);
        }
      } catch (e) {
        console.error("Resume failed", e);
        setIfChanged(get(), set, { isPlaying: false });
        toast.error("Playback failed. Try again.");
      }
    })();
  },

  pause: () => {
    const audio = get()._activeAudio === 'A' ? get()._audioA : get()._audioB;
    audio?.pause();
    setIfChanged(get(), set, { isPlaying: false, isLoadingNext: false, lastPlayStart: 0 });
    get().setIdleTimeout();
  },

  resume: () => {
    const { _activeAudio, _audioA, _audioB, _audioCtx, _gainA, _gainB, currentSong, playSong } = get();
    const audio = _activeAudio === 'A' ? _audioA : _audioB;
    const gain = _activeAudio === 'A' ? _gainA : _gainB;
    if (!audio || !audio.src) {
      if (currentSong) {
        toast.info("Resuming session...");
        playSong(currentSong);
      }
      return;
    }
    (async () => {
      try {
        if (_audioCtx?.state === 'suspended') {
          await _audioCtx.resume();
        }
        await waitFor(START_PLAY_DELAY_MS);
        await audio.play();
        if (_audioCtx) {
          rampGainIn(gain, _audioCtx);
        }
      } catch (e) {
        console.error("Resume failed", e);
        setIfChanged(get(), set, { isPlaying: false });
        toast.error("Playback failed. Try again.");
      }
    })();
  },

  next: async () => {
    get().recordPlay();

    // CRITICAL FIX: Maintain service during transition
    // Set isLoadingNext and keep isPlaying true to prevent service termination
    setIfChanged(get(), set, { isLoadingNext: true, isPlaying: true });

    // Keep notification alive during fetch
    if (Capacitor.isNativePlatform()) {
      updateNativeControls(get(), false);
    }

    // 1. Check Local Queue First (Fastest)
    const { queue } = get();
    if (queue.length > 0) {
      const nextSong = queue[0];
      const newQueue = queue.slice(1);
      
      // Update local state first
      setIfChanged(get(), set, { queue: newQueue });
      
      // Play immediately
      await get().playSong(nextSong);

      // Sync backend in background
      (async () => {
        try {
          await playerApi.modifyQueue('clear', {});
          for (const song of newQueue) {
            await playerApi.addToQueue(song.id);
          }
        } catch (error) {
          console.error('Failed to sync queue after next:', error);
        }
      })();
      return;
    }

    // 2. Fetch from API
    try {
      const res = await playerApi.next();
      if (res.data.id) {
        await get().playSong(res.data);
      } else {
        // No more songs, allow service to stop
        setIfChanged(get(), set, { isLoadingNext: false, isPlaying: false });
      }
    } catch (e) {
      console.error("Next failed", e);
      setIfChanged(get(), set, { isLoadingNext: false, isPlaying: false });
    }
  },

  prev: async () => {
    get().recordPlay();

    // Same guard as next(): keep isPlaying true and set isLoadingNext so the
    // pause handler doesn't kill the notification during the song swap.
    setIfChanged(get(), set, { isLoadingNext: true, isPlaying: true });

    if (Capacitor.isNativePlatform()) {
      updateNativeControls(get(), false);
    }

    try {
      const res = await playerApi.prev();
      if (res.data.id) {
        await get().playSong(res.data);
      } else {
        setIfChanged(get(), set, { isLoadingNext: false, isPlaying: false });
      }
    } catch (e) {
      console.error("Prev failed", e);
      setIfChanged(get(), set, { isLoadingNext: false, isPlaying: false });
    }
  },

  seek: (time: number) => {
    const audio = get()._activeAudio === 'A' ? get()._audioA : get()._audioB;
    if (audio) {
      audio.currentTime = time;
      if (Capacitor.isNativePlatform() && isControlsCreated) {
        MusicControls.updateElapsed({ elapsed: time, isPlaying: get().isPlaying });
      }
    }
  },

  setVolume: (volume: number) => {
    if (Math.abs(get().volume - volume) < 0.001) return;
    setIfChanged(get(), set, { volume });
    const { _audioA, _audioB } = get();
    if (_audioA) _audioA.volume = volume;
    if (_audioB) _audioB.volume = volume;
    if (window.electronAPI) window.electronAPI.setSystemVolume(Math.round(volume * 100));
  },

  setProgress: (progress: number) => {
    const audio = get()._activeAudio === 'A' ? get()._audioA : get()._audioB;
    if (audio && Math.abs(audio.currentTime - progress) >= PROGRESS_EPSILON) {
      audio.currentTime = progress;
    }
    if (Math.abs(get().progress - progress) >= PROGRESS_EPSILON) {
      set({ progress });
    }
  },

  toggleShuffle: async () => {
    const newShuffle = !get().shuffle;
    try { await playerApi.shuffle(newShuffle); setIfChanged(get(), set, { shuffle: newShuffle }); } catch (e) { console.error(e); }
  },

  toggleRepeat: async () => {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const nextIdx = (modes.indexOf(get().repeat) + 1) % 3;
    const newMode = modes[nextIdx];
    try { await playerApi.repeat(newMode); setIfChanged(get(), set, { repeat: newMode }); } catch (e) { console.error(e); }
  },

  addToQueue: (song: Song) => {
    set((state) => {
      if (state.queue[state.queue.length - 1]?.id === song.id) {
        return state;
      }
      return { queue: [...state.queue, song] };
    });
    playerApi.addToQueue(song.id).catch(() => { });
  },

  loadQueue: async () => {
    try {
      const res = await playerApi.queue();
      const { queue } = normalizeQueueResponse<Song>(res.data);
      if (!areQueuesEqual(get().queue, queue)) {
        setIfChanged(get(), set, { queue });
      }
    } catch (e) {
      console.error('Failed to hydrate queue', e);
      if (get().queue.length > 0) {
        setIfChanged(get(), set, { queue: [] });
      }
      toast.error('Failed to load data');
    }
  },



  recordPlay: async () => {
    // Playback analytics are seeded by /player/play and finalized by
    // _logDuration() via /songs/:id/played, so this remains a no-op
    // to avoid duplicate zero-duration rows in Sound Capsule stats.
  },

  playRadio: async (seedSongId: number) => {
    try {
      const res = await radioApi.song(seedSongId);
      const songs = res.data;
      if (!songs || songs.length === 0) return;
      await get().playCollection(songs);
    } catch (e) { console.error(e); }
  },

  reset: () => {
    const { _audioA, _audioB } = get();
    if (_audioA) { _audioA.pause(); _audioA.src = ''; }
    if (_audioB) { _audioB.pause(); _audioB.src = ''; }
    setIfChanged(get(), set, { currentSong: null, isPlaying: false, progress: 0, duration: 0, queue: [], _isCrossfading: false });
    get().cancelSleepTimer();
  },

  setSleepTimer: (minutes: number) => {
    const { cancelSleepTimer } = get();
    cancelSleepTimer();
    const end = Date.now() + minutes * 60 * 1000;
    const timeout = setTimeout(() => {
      get().pause();
      setIfChanged(get(), set, { sleepTimerEnd: null, _sleepTimeout: null });
    }, minutes * 60 * 1000);
    setIfChanged(get(), set, { sleepTimerEnd: end, _sleepTimeout: timeout });
  },

  cancelSleepTimer: () => {
    const { _sleepTimeout } = get();
    if (_sleepTimeout) clearTimeout(_sleepTimeout);
    setIfChanged(get(), set, { sleepTimerEnd: null, _sleepTimeout: null });
  },

  setVisualizerColor: (color: string | null) => {
    if (get().visualizerColor === color) return;
    set({ visualizerColor: color });
  },
  setEqBand: (index: number, gain: number) => {
    const currentGains = get().eqGains;
    if (currentGains[index] === gain) return;
    const newGains = [...currentGains];
    newGains[index] = gain;
    if (!areNumberArraysEqual(currentGains, newGains)) {
      setIfChanged(get(), set, { eqGains: newGains });
    }
    const nodes = get()._eqNodes;
    if (nodes[index]) nodes[index].gain.setTargetAtTime(gain, get()._audioCtx?.currentTime || 0, 0.05);
  },
  setVinylMode: () => set({ vinylMode: false }),
  setCrossfadeEnabled: (enabled: boolean) => {
    setIfChanged(get(), set, { crossfadeEnabled: enabled });
  },
  setCrossfadeDuration: (duration: number) => setIfChanged(get(), set, { crossfadeDuration: duration }),

  setAiDjMode: () => set({ aiDjMode: false }),

  fetchLyrics: async () => {
    const { currentSong } = get();
    if (!currentSong) return;

    // Only set loading if not already showing something useful to avoid flickering, 
    // or just a subtle indicator. But here we reset.
    if (get().lyrics !== "Searching for lyrics...") {
      setIfChanged(get(), set, { lyrics: "Searching for lyrics..." });
    }

    try {
      const query = `${currentSong.title} ${currentSong.artist}`;
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const best = data[0];
        if (get().currentSong?.id === currentSong.id) {
          setIfChanged(get(), set, { lyrics: best.syncedLyrics || best.plainLyrics || "No lyrics found for this track." });
        }
      } else {
        // Fun randomized "no lyrics" messages
        const noLyricsMessages = [
          "Yeah… we looked. Hard. Lyrics said \"nah\".",
          "Lyrics are currently on vacation. No return date.",
          "This song is too mysterious for words apparently.",
          "We searched the database. The database searched back. Nothing.",
          "Lyrics not found. Imagination unlocked 🔓",
          "Even the internet shrugged on this one.",
          "These lyrics are in another universe.",
          "Guess the lyrics today. Winner gets nothing.",
          "Lyrics said \"I'm not feeling it today\".",
          "This song communicates through vibes, not words.",
          "We asked politely. Lyrics ghosted us.",
          "Lyrics unavailable. Start humming.",
          "The lyrics ran away mid-chorus.",
          "This track is instrumental… emotionally.",
          "No lyrics found. Make something up and commit to it.",
          "Lyrics are loading… just kidding.",
          "Somewhere out there, the lyrics exist. Just not here.",
          "The singer forgot the words too, don't worry.",
          "This song speaks in feelings, not sentences.",
          "Lyrics not found. Sing \"la la la\" confidently.",
          "Even Google said \"bro idk\".",
          "The lyrics are shy today.",
          "We checked. Twice. Thrice. Still nope.",
          "These lyrics are classified information.",
          "Lyrics.exe has stopped working.",
          "This song chose silence.",
          "If vibes were words, this would be a novel.",
          "Lyrics missing. Aura present.",
          "Congrats, you unlocked freestyle mode.",
          "No lyrics found — make it deep in your head."
        ];
        const randomMessage = noLyricsMessages[Math.floor(Math.random() * noLyricsMessages.length)];
        if (get().currentSong?.id === currentSong.id) {
          setIfChanged(get(), set, { lyrics: randomMessage });
        }
      }
    } catch (e) {
      console.error("Lyrics fetch error:", e);
      if (get().currentSong?.id === currentSong.id) {
        setIfChanged(get(), set, { lyrics: "Failed to connect to lyrics engine." });
      }
    }
  },
  setShowLyrics: (show: boolean) => {
    setIfChanged(get(), set, { showLyrics: show });
    if (show && !get().lyrics) {
      get().fetchLyrics();
    }
  },



  // ... (previous store code)

  // Helper to update Media Session Metadata
  updateMediaSession: () => {
    if (!('mediaSession' in navigator)) return;
    const { currentSong, isPlaying } = get();
    if (!currentSong) return;

    // Set metadata
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist,
      album: currentSong.album || 'Krew Mobile',
      artwork: [
        { src: currentSong.cover ? (currentSong.cover.startsWith('http') ? currentSong.cover : `${API_URL}${API_URL.endsWith('/') ? '' : '/'}/covers/${currentSong.cover.startsWith('/') ? currentSong.cover.slice(1) : currentSong.cover}`) : 'https://via.placeholder.com/512', sizes: '512x512', type: 'image/jpeg' }
      ]
    });

    // Set playback state
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    // Set handlers (idempotent, can call multiple times)
    navigator.mediaSession.setActionHandler('play', () => {
      get().resume();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      get().pause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      get().prev();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      get().next();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime && details.fastSeek === undefined) {
        get().seek(details.seekTime);
        get().setProgress(details.seekTime);
      }
    });
  },

}));

// Subscribe to state changes to update Media Session (Native Plugin Version)
import { Capacitor } from '@capacitor/core';
import { CapacitorMusicControls as MusicControls } from 'capacitor-music-controls-plugin-v3';

let isControlsCreated = false;
let nativePreviousSongId: number | null = null;
let nativePreviousIsPlaying: boolean | null = null;
let nativePreviousElapsedSecond: number | null = null;
let lastNativeUpdate = 0;

// BUG 4 FIX: Register the controlsNotification handler ONCE at module load.
// Previously it was registered inside updateNativeControls inside an if(!isControlsCreated)
// block, which caused listeners to stack if isControlsCreated was reset by an error.
if (Capacitor.isNativePlatform()) {
  document.addEventListener('controlsNotification', (e: any) => {
    const message = e.message || (e.detail && e.detail.message) || (e.detail);
    const store = usePlayerStore.getState();

    switch (message) {
      case 'music-controls-next':
        store.next();
        break;
      case 'music-controls-previous':
        store.prev();
        break;
      case 'music-controls-pause':
        store.pause();
        break;
      case 'music-controls-play':
        store.resume();
        break;
      case 'music-controls-destroy':
        // User swiped away (if dismissable) or closed
        store.pause();
        isControlsCreated = false;
        break;
      case 'music-controls-seek-to':
        try {
          const seekDetail = e.detail !== undefined ? e.detail : e.message;
          const parsed = typeof seekDetail === 'string' ? JSON.parse(seekDetail) : seekDetail;
          if (parsed && parsed.position !== undefined) {
            store.seek(parsed.position);
            store.setProgress(parsed.position);
          }
        } catch (err) { console.error("Seek parse err", err); }
        break;
      case 'music-controls-toggle-play-pause': // Headset events
        if (store.isPlaying) store.pause();
        else store.resume();
        break;
    }
  });
}

const safeUpdateNativeControls = (state: PlayerState, songChanged = false) => {
  const now = Date.now();
  // Ensure metadata changes (songChanged) always go through, throttle state updates
  if (!songChanged && (now - lastNativeUpdate < 500)) return;
  lastNativeUpdate = now;
  updateNativeControls(state, songChanged);
};

// Helper to create/update controls
const updateNativeControls = async (state: PlayerState, songChanged: boolean = false) => {
  if (!Capacitor.isNativePlatform() || !state.currentSong) return;

  const { currentSong, isPlaying } = state;

  // Construct robust cover URL with a safe local fallback so a CORS-blocked
  // image never causes the notification creation to reject on Android.
  const buildCoverUrl = (song: PlayerState['currentSong']): string => {
    if (!song?.cover) return 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=512&h=512&fit=crop';
    if (song.cover.startsWith('http')) return song.cover;
    // Relative path → absolute backend URL
    const base = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    const path = song.cover.startsWith('/') ? song.cover : `/covers/${song.cover}`;
    return `${base}${path}`;
  };

  const coverUrl = buildCoverUrl(currentSong);

  // BULLETPROOF duration guard: never pass 0 or NaN to MusicControls.
  // Fallback chain: state.duration → song.duration (from API) → 180 (safe minimum).
  const defaultDuration = (state.duration > 0 && !isNaN(state.duration))
    ? state.duration
    : (currentSong.duration && currentSong.duration > 0 ? currentSong.duration : 180);
  const defaultElapsed = (!isNaN(state.progress) && state.progress >= 0) ? state.progress : 0;

  // BUG 2 FIX: The handler is now registered once at module load (Bug 4 fix above).
  // We no longer need to manage addEventListener/removeEventListener here.
  try {
    if (!isControlsCreated) {
      // Set to true immediately to act as a lock
      isControlsCreated = true;
      try {
        await MusicControls.create({
          track: currentSong.title || 'Unknown Track',
          artist: currentSong.artist || 'Unknown Artist',
          album: currentSong.album || 'Krew Mobile',
          cover: coverUrl,
          isPlaying: isPlaying,
          dismissable: true,
          hasPrev: true,
          hasNext: true,
          hasClose: false,
          hasScrubbing: true,
          notificationIcon: 'ic_notification',
          duration: defaultDuration,
          elapsed: defaultElapsed
        });
      } catch (err) {
        isControlsCreated = false;
        throw err;
      }
    } else {
      // Song changed OR playback state changed
      // CRITICAL FIX: Do NOT destroy notification during song change!
      // Destroying causes Android to kill the background service.
      // Instead, call create() again which updates the existing notification.
      if (songChanged) {
        try {
          await MusicControls.create({
            track: currentSong.title || 'Unknown Track',
            artist: currentSong.artist || 'Unknown Artist',
            album: currentSong.album || 'Krew Mobile',
            cover: coverUrl,
            isPlaying: isPlaying,
            dismissable: true,
            hasPrev: true,
            hasNext: true,
            hasClose: false,
            hasScrubbing: true,
            notificationIcon: 'ic_notification',
            duration: defaultDuration,
            elapsed: defaultElapsed
          });
        } catch (err) {
          isControlsCreated = false;
          console.error("Failed to re-create controls", err);
        }
      } else {
        // Playback state changed: update state with the current elapsed position
        // so Android can keep the media session progress accurate.
        await MusicControls.updateElapsed({ elapsed: defaultElapsed, isPlaying: isPlaying });
      }
    }
  } catch (e) {
    console.error("Error updating music controls", e);
  }
};

usePlayerStore.subscribe((state) => {
  if (!state.currentSong) return;

  const currentSongId = state.currentSong.id;
  const isPlaying = state.isPlaying;

  // 1. Song Changed -> Update Controls with new metadata
  if (currentSongId !== nativePreviousSongId) {
    nativePreviousSongId = currentSongId;
    safeUpdateNativeControls(state, true); // Pass true for songChanged
  }
  // 2. Playback State Changed -> Update isPlaying only
  else if (nativePreviousIsPlaying !== isPlaying) {
    nativePreviousIsPlaying = isPlaying;

    if (Capacitor.isNativePlatform()) {
      safeUpdateNativeControls(state, false);
    }
  }

  if (Capacitor.isNativePlatform() && isControlsCreated && isPlaying) {
    const elapsedSecond = Math.max(0, Math.floor(state.progress || 0));
    if (nativePreviousElapsedSecond !== elapsedSecond) {
      nativePreviousElapsedSecond = elapsedSecond;
      MusicControls.updateElapsed({ elapsed: elapsedSecond, isPlaying: true });
    }
  } else if (!isPlaying) {
    nativePreviousElapsedSecond = Math.max(0, Math.floor(state.progress || 0));
  }
});

// Subscribe to state changes to update Media Session (Web API Version)
// We track previous state to avoid redundant updates (especially on progress)
let webPreviousSongId: number | null = null;
let webPreviousIsPlaying: boolean | null = null;

usePlayerStore.subscribe((state) => {
  if (!('mediaSession' in navigator) || !state.currentSong) return;

  const currentSongId = state.currentSong.id;
  const isPlaying = state.isPlaying;

  // 1. Update Metadata Only if Song Changed
  if (currentSongId !== webPreviousSongId) {
    webPreviousSongId = currentSongId;

    // Construct robust cover URL or use a safe internet placeholder
    const coverUrl = state.currentSong.cover
      ? (state.currentSong.cover.startsWith('http')
        ? state.currentSong.cover
        : `${API_URL}${API_URL.endsWith('/') ? '' : '/'}/covers/${state.currentSong.cover.startsWith('/') ? state.currentSong.cover.slice(1) : state.currentSong.cover}`)
      : 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=512&h=512&fit=crop'; // Safe placeholder

    // Debug Toast for notification logic (Can remove later)
    // console.log("[MediaSession] Updating Metadata:", state.currentSong.title);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.currentSong.title,
      artist: state.currentSong.artist,
      album: state.currentSong.album || 'Krew Mobile',
      artwork: [
        { src: coverUrl, sizes: '512x512', type: 'image/jpeg' },
        { src: coverUrl, sizes: '96x96', type: 'image/jpeg' }
      ]
    });

    // Re-bind actions (Idempotent, safe to do on song change)
    navigator.mediaSession.setActionHandler('play', () => usePlayerStore.getState().resume());
    navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().pause());
    navigator.mediaSession.setActionHandler('previoustrack', () => usePlayerStore.getState().prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => usePlayerStore.getState().next());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime && details.fastSeek === undefined) {
        usePlayerStore.getState().seek(details.seekTime);
        usePlayerStore.getState().setProgress(details.seekTime);
      }
    });
  }

  // 2. Update Playback State Only if Changed
  if (webPreviousIsPlaying !== isPlaying) {
    webPreviousIsPlaying = isPlaying;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    // Important: Update position state if supported
    if ('setPositionState' in navigator.mediaSession) {
      navigator.mediaSession.setPositionState({
        duration: state.duration || 0,
        playbackRate: 1.0,
        position: state.progress || 0
      });
    }
  }
});
