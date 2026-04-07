import { create } from 'zustand';
import { songsApi, playerApi, radioApi, API_URL } from '@/lib/api';
import { normalizeQueueResponse } from '@/lib/queue';
import { toast } from 'sonner';

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


  // Visualizer
  visualizerColor: string | null;
  setVisualizerColor: (color: string | null) => void;

  // Lab (EQ & FX)
  eqGains: number[];
  vinylMode: boolean;
  setEqBand: (index: number, gain: number) => void;
  setVinylMode: (enabled: boolean) => void;
  // AI DJ
  aiDjMode: boolean;
  setAiDjMode: (enabled: boolean) => void;

  // Crossfade
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
  setShowDashboard: (show) => set({ showDashboard: show }),
  lastPlayStart: 0,
  isRemoteUpdate: false,
  isLoadingNext: false,

  visualizerColor: null,
  eqGains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  vinylMode: false,
  aiDjMode: true,
  crossfadeDuration: 6, // Optimized for smooth transitions

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
    set({ _idleTimeout: timeout });
  },
  clearIdleTimeout: () => {
    const { _idleTimeout } = get();
    if (_idleTimeout) clearTimeout(_idleTimeout);
    set({ _idleTimeout: null });
  },
  _activeAudio: 'A',
  _isCrossfading: false,
  _audioCtx: null,
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
    set({ fxReverbWet: wet });
    const { _reverbGainNode } = get();
    if (_reverbGainNode) _reverbGainNode.gain.value = wet;
  },

  setFxDelay: (time, feedback) => {
    set({ fxDelayTime: time, fxDelayFeedback: feedback });
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
  setExpanded: (expanded: boolean) => set({ isExpanded: expanded }),

  // Cleanup Action
  cleanupAudio: () => {
    const { _audioA, _audioB, _audioCtx } = get();

    // Stop all nodes
    _audioA?.pause();
    _audioB?.pause();

    // Remove listeners (Garbage Collection)
    _audioA?.removeAttribute('src');
    _audioB?.removeAttribute('src');
    _audioA?.load();
    _audioB?.load();

    // Close AudioContext if running (Releases hardware on Android)
    if (_audioCtx && _audioCtx.state !== 'closed') {
      _audioCtx.suspend().catch(console.error);
    }

    set({
      audio: null,
      _audioA: null, _audioB: null,
      _audioCtx: null,
      analyser: null,
      isPlaying: false
    });
  },

  initAudio: () => {
    // SINGLETON PATTERN: Don't create if exists and running
    const existing = get()._audioCtx;
    if (typeof window !== 'undefined' && existing && existing.state !== 'closed') {
      return;
    }

    if (typeof window !== 'undefined') {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext(); // New Context

      const createAudioNode = () => {
        const audio = new Audio();
        // crossOrigin is required for Web Audio API (createMediaElementSource)
        // to work without CORS-tainting the audio stream.
        // R2 bucket CORS is configured at backend startup (put_bucket_cors).
        audio.crossOrigin = "anonymous";
        audio.volume = get().volume;
        return audio;
      };

      const audioA = createAudioNode();
      const audioB = createAudioNode();

      const gainA = ctx.createGain();
      const gainB = ctx.createGain();
      gainA.gain.value = 1;
      gainB.gain.value = 0;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      const bands = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      const eqNodes: BiquadFilterNode[] = [];

      try {
        const eqInput = ctx.createGain();

        const isMobile = Capacitor.isNativePlatform();

        // Connect Sources — createMediaElementSource captures the audio
        // element's output into the Web Audio API graph for analysis.
        // R2 CORS is configured at backend startup so crossOrigin="anonymous"
        // works without CORS-tainting on Android.
        try {
          const sourceA = ctx.createMediaElementSource(audioA);
          const sourceB = ctx.createMediaElementSource(audioB);
          sourceA.connect(gainA);
          sourceB.connect(gainB);
        } catch (e) { console.warn("MediaElementSource already connected?", e); }

        gainA.connect(eqInput);
        gainB.connect(eqInput);

        if (isMobile) {
          // --- MOBILE PATH (Lightweight) ---
          // Source -> Gain -> Analyser -> Destination
          // We bypass EQ, Delay, Reverb, Vinyl to prevent crackling on low-end devices
          // but keep the analyser for real song-synced visualizations.

          eqInput.connect(analyser);
          analyser.connect(ctx.destination);

          // Events
          const setupEvents = (audio: HTMLAudioElement) => {
            // Remove old listeners to prevent stacking
            audio.onended = null;
            audio.ontimeupdate = null;
            audio.onplay = null;
            audio.onpause = null;

            audio.addEventListener('timeupdate', () => {
              const state = get();
              if ((state._audioA === audio && state._activeAudio === 'A') ||
                (state._audioB === audio && state._activeAudio === 'B')) {
                const duration = Math.max(0, audio.duration || 0);
                set({ progress: audio.currentTime, duration });
                const timeLeft = duration - audio.currentTime;
                if (timeLeft > 0 && timeLeft <= state.crossfadeDuration && !state._isCrossfading && state.queue.length > 0) {
                  get()._handleCrossfadeAuto();
                }
              }
            });
            audio.addEventListener('ended', () => {
              if (get()._isCrossfading) return;
              if (get().repeat === 'one') {
                get().recordPlay();
                audio.currentTime = 0;
                audio.play();
                return;
              }
              set({ isLoadingNext: true });
              get().next();
            });
            audio.addEventListener('play', async () => {
              // Resume AudioContext BEFORE anything else.
              // Calling audio.play() while the ctx is suspended creates a dangling
              // AudioTrack on Android that ends in a silent OOM / AudioFlinger crash.
              if (ctx.state === 'suspended') {
                try { await ctx.resume(); } catch (e) { console.warn('ctx.resume() in play handler failed', e); }
              }
              set({ isPlaying: true, lastPlayStart: Date.now() });
              get().clearIdleTimeout();
            });
            audio.addEventListener('pause', () => {
              get()._logDuration();
              set({ lastPlayStart: 0 });
              if (!get()._isCrossfading && !get().isLoadingNext) {
                set({ isPlaying: false });
                get().setIdleTimeout();
              }
            });
          };
          setupEvents(audioA);
          setupEvents(audioB);

          // Set State (Skip FX nodes, keep analyser)
          set({
            audio: audioA,
            analyser,
            _audioA: audioA,
            _audioB: audioB,
            _gainA: gainA,
            _gainB: gainB,
            _audioCtx: ctx,
            _activeAudio: 'A',
            _eqNodes: [],
            _vinylNode: null,
            _vinylNoiseNode: null,
            _vinylNoiseGain: null,
            _delayNode: null,
            _delayFeedbackNode: null,
            _convolverNode: null,
            _reverbGainNode: null
          });
          return;
        }

        // --- DESKTOP PATH (Full FX) ---
        let lastNode: AudioNode = eqInput;

        bands.forEach((freq, i) => {
          const filter = ctx.createBiquadFilter();
          filter.type = 'peaking';
          filter.frequency.value = freq;
          filter.Q.value = 1;
          filter.gain.value = get().eqGains[i];
          lastNode.connect(filter);
          eqNodes.push(filter);
          lastNode = filter;
        });

        // --- FX NODES ---
        // 1. Bitcrusher (ScriptProcessor)
        // 1. Distortion (WaveShaper) - Native Audio Node

        /* bitCrusherNode.onaudioprocess = (e) => {
          try {
            const depth = get().fxBitCrusher;
            const active = get().fxBitCrusherActive;
            const inputBuffer = e.inputBuffer;
            const outputBuffer = e.outputBuffer;

            // Bypass if inactive or invalid depth
            if (!active || !depth || depth < 1) {
              for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
                outputBuffer.getChannelData(channel).set(inputBuffer.getChannelData(channel));
              }
              return;
            }

            const step = Math.pow(0.5, depth);
            const invStep = 1 / step;

            for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
              const inputData = inputBuffer.getChannelData(channel);
              const outputData = outputBuffer.getChannelData(channel);

              for (let i = 0; i < bufferSize; i++) {
                outputData[i] = Math.round(inputData[i] * invStep) * step;
              }
            }
          } catch (err) {
             console.error(err);
          }
        }; */

        // 2. Delay
        // --- FX NODES (Conditional) ---
        // On Mobile, we skip heavy FX (Reverb, Delay, Vinyl) to prevent audio artifacts ("creaking")
        // On Mobile, we skip heavy FX (Reverb, Delay, Vinyl) to prevent audio artifacts ("creaking")

        // 2. Delay
        const delayNode = ctx.createDelay(5.0);
        const delayFeedback = ctx.createGain();
        delayNode.delayTime.value = 0;
        delayFeedback.gain.value = 0;

        // 3. Reverb
        const convolverNode = ctx.createConvolver();
        const sampleRate = ctx.sampleRate;
        const length = sampleRate * 3; // 3 seconds tail
        const impulse = ctx.createBuffer(2, length, sampleRate);
        for (let channel = 0; channel < 2; channel++) {
          const channelData = impulse.getChannelData(channel);
          for (let i = 0; i < length; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
          }
        }
        convolverNode.buffer = impulse;

        const reverbGain = ctx.createGain();
        reverbGain.gain.value = 0;

        const dryGain = ctx.createGain();
        dryGain.gain.value = 1;

        // Vinyl Node
        const vinylFilter = ctx.createBiquadFilter();
        vinylFilter.type = 'lowpass';
        vinylFilter.frequency.value = get().vinylMode ? 2000 : 22000;

        // --- CONNECT FX CHAIN ---
        // EQ Output -> Delay Input (Distortion Removed)
        lastNode.connect(delayNode);

        // Delay Loop
        delayNode.connect(delayFeedback);
        delayFeedback.connect(delayNode);

        // EQ Output -> Reverb Input (Distortion Removed)
        lastNode.connect(convolverNode);

        // Main signal path (Dry)
        lastNode.connect(dryGain);

        // Connect Wet Signals to Summing Point (Vinyl)
        dryGain.connect(vinylFilter);
        delayNode.connect(vinylFilter);
        reverbGain.connect(vinylFilter);
        convolverNode.connect(reverbGain);

        // Update "lastNode" pointer for final connection
        // (Vinyl is now the last processor before destination)
        lastNode = vinylFilter;




        const generateNoise = () => {
          const bufferSize = 2 * ctx.sampleRate;
          const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            const crackle = Math.random() > 0.999 ? (Math.random() * 2 - 1) * 0.5 : 0;
            output[i] = (white * 0.01) + crackle;
          }
          return noiseBuffer;
        };

        const noiseNode = ctx.createBufferSource();
        noiseNode.buffer = generateNoise();
        noiseNode.loop = true;
        const noiseGain = ctx.createGain();
        noiseGain.gain.value = get().vinylMode ? 0.2 : 0;
        noiseNode.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noiseNode.start();

        lastNode.connect(analyser);
        analyser.connect(ctx.destination);

        const setupEvents = (audio: HTMLAudioElement) => {
          // Remove old listeners
          audio.onended = null;
          audio.ontimeupdate = null;
          audio.onplay = null;
          audio.onpause = null;

          audio.addEventListener('timeupdate', () => {
            const state = get();
            if ((state._audioA === audio && state._activeAudio === 'A') ||
              (state._audioB === audio && state._activeAudio === 'B')) {

              const duration = Math.max(0, audio.duration || 0);
              set({ progress: audio.currentTime, duration });

              const timeLeft = duration - audio.currentTime;
              if (timeLeft > 0 && timeLeft <= state.crossfadeDuration && !state._isCrossfading && state.queue.length > 0) {
                get()._handleCrossfadeAuto();
              }
            }
          });

          audio.addEventListener('ended', () => {
            if (get()._isCrossfading) return;

            // Handle Repeat One
            if (get().repeat === 'one') {
              get().recordPlay();
              audio.currentTime = 0;
              audio.play();
              return;
            }

            // isLoadingNext prevents the OS from killing the background service.
            // Subscriber handles notification — no direct call needed here.
            set({ isLoadingNext: true });
            get().next();
          });

          audio.addEventListener('play', async () => {
            // BUG 5 FIX: Resume AudioContext BEFORE anything else on desktop too.
            if (ctx.state === 'suspended') {
              try { await ctx.resume(); } catch (e) { console.warn('ctx.resume() in play handler failed', e); }
            }
            set({ isPlaying: true, lastPlayStart: Date.now() });
            get().clearIdleTimeout();
          });

          audio.addEventListener('error', (e: Event) => {
            const error = (e.target as HTMLAudioElement).error;
            let msg = 'Unknown playback error';
            if (error) {
              msg = `Code: ${error.code} (${error.message})`;
            }
            console.error('Audio Playback Error:', msg, audio.src);
            toast.error(`Audio Error: ${msg}`);

            // Auto-skip if playback fails
            if (get().isPlaying && !get().isLoadingNext) {
              console.log("Auto-skipping due to error...");
              // set({ isPlaying: false }); // Optional: stop or skip
              get().next();
            }
          });

          audio.addEventListener('pause', () => {
            get()._logDuration();
            set({ lastPlayStart: 0 });
            // CRITICAL FIX: Do NOT set IsPlaying False if we are loading next song
            // This prevents the OS from killing the background service
            if (!get()._isCrossfading && !get().isLoadingNext) {
              set({ isPlaying: false });
              get().setIdleTimeout();
            }
          });
        };

        setupEvents(audioA);
        setupEvents(audioB);

        set({
          audio: audioA,
          analyser,
          _audioA: audioA,
          _audioB: audioB,
          _gainA: gainA,
          _gainB: gainB,
          _audioCtx: ctx,
          _eqNodes: eqNodes,
          _vinylNode: vinylFilter,
          _vinylNoiseNode: noiseNode,
          _vinylNoiseGain: noiseGain,
          _activeAudio: 'A',

          // FX Node Refs

          _delayNode: delayNode,
          _delayFeedbackNode: delayFeedback,
          _convolverNode: convolverNode,
          _reverbGainNode: reverbGain
        });
      } catch (e) {
        console.error("Audio init error:", e);
      }
    }
  },

  playSong: async (song: Song) => {
    get()._logDuration(); // Log previous song if any
    set({ lastPlayStart: 0 });
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
    set({ _isCrossfading: false });
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
      const response = await playerApi.play(song.id);
      const data = response.data;

      if (activeGain && oppositeGain) {
        activeGain.gain.setValueAtTime(1, ctx.currentTime);
        oppositeGain.gain.setValueAtTime(0, ctx.currentTime);
      }
      oppositeAudio.pause();

      // Future Playback Switch for Offline files
      const offlineSong = song as any;
      if (offlineSong.local && offlineSong.filePath) {
        audio.src = Capacitor.isNativePlatform()
          ? Capacitor.convertFileSrc(offlineSong.filePath)
          : (data.audio || songsApi.stream(song.id));
      } else {
        audio.src = data.audio || songsApi.stream(song.id);
      }

      audio.load();

      // FIX #2: Resume AudioContext BEFORE audio.play().
      // Calling play() while the context is suspended causes a dangling AudioTrack
      // on Android (crash at the AudioFlinger/AudioTrack level).
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      await audio.play();

      // BUG 3 FIX: Now that audio.play() has resolved, clear isLoadingNext.
      // This is the safe point — the pause handler can now set isPlaying=false.
      set({
        currentSong: { ...song, cover: data.cover || song.cover, audio: data.audio },
        isPlaying: true,
        isLoadingNext: false,
        audio: audio,
        lyrics: null
      });

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
      set({ isLoadingNext: false });

      const isInterruption = e.message?.includes('interrupted by a new load request') || e.name === 'AbortError';
      if (isInterruption) {
        console.warn('Play interrupted by new load (harmless)');
        return;
      }
      console.error('Play failed', e);
      set({ isPlaying: false }); // safe to set false now — playback genuinely failed
      toast.error(`Playback failed: ${e.message || 'Unknown error'}`);
    }
  },

  playCollection: async (songs: Song[], startIndex = 0) => {
    if (!songs.length) return;

    const safeStartIndex = Math.min(Math.max(startIndex, 0), songs.length - 1);
    const current = songs[safeStartIndex];
    const remaining = songs.slice(safeStartIndex + 1);

    await get().playSong(current);

    if (get().currentSong?.id !== current.id) {
      return;
    }

    try {
      await playerApi.modifyQueue('clear', {});
    } catch (error) {
      console.error('Failed to clear queue before collection playback', error);
    }

    const queuedSongs: Song[] = [];
    set({ queue: [] });

    for (const song of remaining) {
      try {
        await playerApi.addToQueue(song.id);
        queuedSongs.push(song);
      } catch (error) {
        console.error(`Failed to queue song ${song.id}`, error);
      }
    }

    set({ queue: queuedSongs });
  },

  _handleCrossfadeAuto: async () => {
    if (get()._isCrossfading) return;
    set({ _isCrossfading: true });

    const state = get();
    const duration = state.crossfadeDuration;
    const ctx = state._audioCtx;
    if (!ctx) return;

    let nextSong: Song | null = null;
    try {
      const res = await playerApi.next();
      if (res.data && res.data.id) {
        nextSong = { id: res.data.id, title: res.data.title, artist: res.data.artist, cover: res.data.cover || null, audio: res.data.audio };
        const localQueueIndex = state.queue.findIndex((song) => song.id === res.data.id);
        if (localQueueIndex >= 0) {
          const remainingQueue = [...state.queue];
          remainingQueue.splice(localQueueIndex, 1);
          set({ queue: remainingQueue });
        }
      }
    } catch (e) { console.error("Crossfade: next fetch failed", e); }

    if (!nextSong) { set({ _isCrossfading: false }); return; }

    const incoming = state._activeAudio === 'A' ? 'B' : 'A';
    const outgoing = state._activeAudio;
    const incomingAudio = incoming === 'A' ? state._audioA : state._audioB;
    const outgoingAudio = outgoing === 'A' ? state._audioA : state._audioB;
    const incomingGain = incoming === 'A' ? state._gainA : state._gainB;
    const outgoingGain = outgoing === 'A' ? state._gainA : state._gainB;

    if (!incomingAudio || !outgoingAudio) { set({ _isCrossfading: false }); return; }

    // AI DJ BEATMATCH
    let startDelay = 0;
    if (state.aiDjMode) {
      // 1. Ensure BPMs (Mocking for now if not present)
      if (!state.currentSong?.bpm) state.currentSong!.bpm = 120 + Math.floor(Math.random() * 20);
      if (!nextSong.bpm) nextSong.bpm = 120 + Math.floor(Math.random() * 20);

      const bpmA = state.currentSong!.bpm!;
      const bpmB = nextSong.bpm!;

      // 2. Adjust Pitch (Sync tempo)
      incomingAudio.playbackRate = bpmA / bpmB;

      // 3. Phase Alignment (Align to next 4-beat bar)
      const beatDuration = 60 / bpmA;
      const barDuration = beatDuration * 4;
      const progress = outgoingAudio.currentTime;
      const timeInBar = progress % barDuration;
      startDelay = barDuration - timeInBar;

      console.log(`[AI DJ] Syncing ${nextSong.title} to ${state.currentSong?.title}`);
      console.log(`[AI DJ] Pitch: ${incomingAudio.playbackRate.toFixed(2)}x | Offset: ${startDelay.toFixed(2)}s`);

      if (startDelay > 2) startDelay = 0; // Guard against long waits
    } else {
      incomingAudio.playbackRate = 1.0;
    }

    incomingAudio.src = nextSong.audio as string;
    incomingAudio.load();
    if (incomingGain) incomingGain.gain.setValueAtTime(0, ctx.currentTime);

    setTimeout(async () => {
      try {
        await incomingAudio.play();
        const now = ctx.currentTime;
        const fadeEndTime = now + duration;

        // ✨ EQUAL-POWER CROSSFADE: Smooth linear ramps
        // This prevents volume dips in the middle of the transition
        // Outgoing: 1 → 0 (fade out)
        if (outgoingGain) {
          outgoingGain.gain.cancelScheduledValues(now);
          outgoingGain.gain.setValueAtTime(1, now);
          outgoingGain.gain.linearRampToValueAtTime(0, fadeEndTime);
        }

        // Incoming: 0 → 1 (fade in)
        if (incomingGain) {
          incomingGain.gain.cancelScheduledValues(now);
          incomingGain.gain.setValueAtTime(0, now);
          incomingGain.gain.linearRampToValueAtTime(1, fadeEndTime);
        }

        set({ currentSong: nextSong, _activeAudio: incoming, audio: incomingAudio, lyrics: null });

        // getting the lyrcis ready so that people who cant wait its ready for them 
        get().fetchLyrics();

        setTimeout(() => {
          outgoingAudio.pause();
          outgoingAudio.currentTime = 0;
          set({ _isCrossfading: false });
        }, duration * 1000);
      } catch (e) { console.error("Crossfade playback error", e); set({ _isCrossfading: false }); }
    }, startDelay * 1000);
  },

  togglePlay: () => {
    const { _activeAudio, _audioA, _audioB, currentSong, playSong } = get();
    const audio = _activeAudio === 'A' ? _audioA : _audioB;

    if (!audio) {
      console.warn("togglePlay: Audio element missing (page reload?), restarting song.");
      if (currentSong) {
        toast.info("Resuming session...");
        playSong(currentSong);
      }
      return;
    }

    if (get().isPlaying) audio.pause();
    else audio.play();
  },

  pause: () => {
    const audio = get()._activeAudio === 'A' ? get()._audioA : get()._audioB;
    audio?.pause();
    set({ isPlaying: false });
  },

  resume: () => {
    const { _activeAudio, _audioA, _audioB, currentSong, playSong } = get();
    const audio = _activeAudio === 'A' ? _audioA : _audioB;
    if (!audio) {
      if (currentSong) {
        toast.info("Resuming session...");
        playSong(currentSong);
      }
      return;
    }
    audio.play();
    set({ isPlaying: true });
  },

  next: async () => {
    get().recordPlay();

    // CRITICAL FIX: Maintain service during transition
    // Set isLoadingNext and keep isPlaying true to prevent service termination
      set({ isLoadingNext: true, isPlaying: true });

    // Keep notification alive during fetch
    if (Capacitor.isNativePlatform()) {
      updateNativeControls(get(), false);
    }

    // 1. Check Local Queue First (Fastest)
    const { queue } = get();
    if (queue.length > 0) {
      const nextSong = queue[0];
      const newQueue = queue.slice(1);
      set({ queue: newQueue });
      await get().playSong(nextSong);

      if (get().currentSong?.id === nextSong.id) {
        try {
          await playerApi.modifyQueue('clear', {});
        } catch (error) {
          console.error('Failed to clear queue after advancing playback', error);
        }

        for (const song of newQueue) {
          try {
            await playerApi.addToQueue(song.id);
          } catch (error) {
            console.error(`Failed to re-queue song ${song.id}`, error);
          }
        }
      }

      return;
    }

    // 2. Fetch from API
    try {
      const res = await playerApi.next();
      if (res.data.id) {
        await get().playSong(res.data);
      } else {
        // No more songs, allow service to stop
        set({ isLoadingNext: false, isPlaying: false });
      }
    } catch (e) {
      console.error("Next failed", e);
      set({ isLoadingNext: false, isPlaying: false });
    }
  },

  prev: async () => {
    get().recordPlay();

    // Same guard as next(): keep isPlaying true and set isLoadingNext so the
    // pause handler doesn't kill the notification during the song swap.
    set({ isLoadingNext: true, isPlaying: true });

    if (Capacitor.isNativePlatform()) {
      updateNativeControls(get(), false);
    }

    try {
      const res = await playerApi.prev();
      if (res.data.id) {
        await get().playSong(res.data);
      } else {
        set({ isLoadingNext: false, isPlaying: false });
      }
    } catch (e) {
      console.error("Prev failed", e);
      set({ isLoadingNext: false, isPlaying: false });
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
    set({ volume });
    const { _audioA, _audioB } = get();
    if (_audioA) _audioA.volume = volume;
    if (_audioB) _audioB.volume = volume;
    if (window.electronAPI) window.electronAPI.setSystemVolume(Math.round(volume * 100));
  },

  setProgress: (progress: number) => {
    const audio = get()._activeAudio === 'A' ? get()._audioA : get()._audioB;
    if (audio) audio.currentTime = progress;
    set({ progress });
  },

  toggleShuffle: async () => {
    const newShuffle = !get().shuffle;
    try { await playerApi.shuffle(newShuffle); set({ shuffle: newShuffle }); } catch (e) { console.error(e); }
  },

  toggleRepeat: async () => {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const nextIdx = (modes.indexOf(get().repeat) + 1) % 3;
    const newMode = modes[nextIdx];
    try { await playerApi.repeat(newMode); set({ repeat: newMode }); } catch (e) { console.error(e); }
  },

  addToQueue: (song: Song) => {
    set((state) => ({ queue: [...state.queue, song] }));
    playerApi.addToQueue(song.id).catch(() => { });
  },

  loadQueue: async () => {
    try {
      const res = await playerApi.queue();
      const { queue } = normalizeQueueResponse<Song>(res.data);
      set({ queue });
    } catch (e) {
      console.error('Failed to hydrate queue', e);
    }
  },



  recordPlay: async () => {
    const { currentSong } = get();
    if (currentSong) {
      playerApi.recordPlay(currentSong.id).catch((e) => {
        console.error("Record Play Failed", e);
        const errMsg = e.response ? `Status ${e.response.status}` : `Err: ${e.message} ${JSON.stringify(e)}`;
        toast.error(`Sync Fail: ${errMsg}`);
      });
    }
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
    set({ currentSong: null, isPlaying: false, progress: 0, duration: 0, queue: [], _isCrossfading: false });
    get().cancelSleepTimer();
  },

  setSleepTimer: (minutes: number) => {
    const { cancelSleepTimer } = get();
    cancelSleepTimer();
    const end = Date.now() + minutes * 60 * 1000;
    const timeout = setTimeout(() => {
      get().pause();
      set({ sleepTimerEnd: null, _sleepTimeout: null });
    }, minutes * 60 * 1000);
    set({ sleepTimerEnd: end, _sleepTimeout: timeout });
  },

  cancelSleepTimer: () => {
    const { _sleepTimeout } = get();
    if (_sleepTimeout) clearTimeout(_sleepTimeout);
    set({ sleepTimerEnd: null, _sleepTimeout: null });
  },

  setVisualizerColor: (color: string | null) => set({ visualizerColor: color }),
  setEqBand: (index: number, gain: number) => {
    const newGains = [...get().eqGains];
    newGains[index] = gain;
    set({ eqGains: newGains });
    const nodes = get()._eqNodes;
    if (nodes[index]) nodes[index].gain.setTargetAtTime(gain, get()._audioCtx?.currentTime || 0, 0.05);
  },
  setVinylMode: (enabled: boolean) => {
    set({ vinylMode: enabled });
    const node = get()._vinylNode;
    const noiseGain = get()._vinylNoiseGain;
    const now = get()._audioCtx?.currentTime || 0;
    if (node) node.frequency.setTargetAtTime(enabled ? 2000 : 22000, now, 0.1);
    if (noiseGain) noiseGain.gain.setTargetAtTime(enabled ? 0.2 : 0, now, 0.2);
  },
  setCrossfadeDuration: (duration: number) => set({ crossfadeDuration: duration }),

  setAiDjMode: (enabled: boolean) => {
    set({ aiDjMode: enabled });
    const { audio } = get();
    if (audio && !enabled) audio.playbackRate = 1.0;
  },

  fetchLyrics: async () => {
    const { currentSong } = get();
    if (!currentSong) return;

    // Only set loading if not already showing something useful to avoid flickering, 
    // or just a subtle indicator. But here we reset.
    set({ lyrics: "Searching for lyrics..." });

    try {
      const query = `${currentSong.title} ${currentSong.artist}`;
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const best = data[0];
        set({ lyrics: best.syncedLyrics || best.plainLyrics || "No lyrics found for this track." });
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
        set({ lyrics: randomMessage });
      }
    } catch (e) {
      console.error("Lyrics fetch error:", e);
      set({ lyrics: "Failed to connect to lyrics engine." });
    }
  },
  setShowLyrics: (show: boolean) => {
    set({ showLyrics: show });
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
