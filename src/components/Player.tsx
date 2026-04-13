import React, { useEffect, useRef, useState, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Visualizer from "./Visualizer";
import { useCoverPalette, useDominantColor } from "@/hooks/useDominantColor";
import { Cast } from "lucide-react";
import AudioDashboard from "./AudioDashboard";
import api, { configureJamPlayback, playlistsApi, API_URL } from "@/lib/api";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  Heart,
  ChevronDown,
  X,
  PlusCircle,
  Plus,
  Check,
  Moon,
  Waves,
  ListMusic,
  Mic2,
  Music2,
  MoreHorizontal,
  Share2,
  PlayCircle,
  PauseCircle,
  Share,
  Download,
  CheckCircle2,
  ListRestart,
  Loader2
} from "lucide-react"

import { Slider } from "@/components/ui/slider"
import { usePlayerStore } from "@/stores/playerStore"
import { useOfflineStore } from "@/stores/offlineStore"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { toast } from "sonner"
import { Capacitor } from "@capacitor/core";

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function AddToPlaylist({ currentSong, children }: { currentSong: any, children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [playlists, setPlaylists] = useState<any[]>([])
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (open) {
      playlistsApi.getAll().then(res => setPlaylists(res.data)).catch(console.error)
    }
  }, [open])

  const handleCreate = async () => {
    if (!search.trim()) return
    try {
      const res = await playlistsApi.create(search)
      const newPlaylist = res.data
      await playlistsApi.addSong(newPlaylist.id, currentSong.id)
      toast.success(`Created "${newPlaylist.name}" and added song`)
      setOpen(false)
    } catch (e) {
      toast.error("Failed to create playlist")
    }
  }

  const handleSelect = async (playlist: any) => {
    try {
      await playlistsApi.addSong(playlist.id, currentSong.id)
      toast.success(`Added to "${playlist.name}"`)
      setOpen(false)
    } catch (e) {
      toast.error("Failed to add to playlist")
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
        {children}
      </PopoverTrigger>
      <PopoverContent className="p-0 w-64 glass-panel" side="top" align="center" onClick={(e) => e.stopPropagation()}>
        <Command className="bg-transparent">
          <CommandInput placeholder="Search or create..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty className="py-2 px-2">
              <button
                className="flex items-center gap-2 w-full p-2 text-sm rounded-sm hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"
                onClick={handleCreate}
              >
                <Plus className="h-4 w-4" />
                Create "{search}"
              </button>
            </CommandEmpty>
            <CommandGroup heading="Playlists">
              {playlists.map((playlist) => (
                <CommandItem
                  key={playlist.id}
                  onSelect={() => handleSelect(playlist)}
                  className="cursor-pointer hover:bg-white/10"
                >
                  <span className="flex-1 truncate">{playlist.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

const parseLyrics = (lrc: string) => {
  const lines = lrc.split('\n');
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const mins = parseInt(match[1]);
      const secs = parseInt(match[2]);
      const ms = parseInt(match[3]);
      const time = mins * 60 + secs + ms / (match[3].length === 3 ? 1000 : 100);
      const text = line.replace(timeRegex, '').trim();
      if (text) result.push({ time, text });
    }
  }
  return result;
};

const LyricsOverlay = memo(function LyricsOverlay({ lyrics, progress, onSeek, coverUrl, uiColor }: {
  lyrics: string | null,
  progress: number,
  onSeek: (time: number) => void,
  coverUrl: string | null,
  uiColor: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const parsedLines = useMemo(() => lyrics ? parseLyrics(lyrics) : [], [lyrics]);

  const activeIndex = parsedLines.findIndex((line, i) => {
    const nextLine = parsedLines[i + 1];
    return progress >= line.time && (!nextLine || progress < nextLine.time);
  });

  useEffect(() => {
    if (activeIndex !== -1 && scrollRef.current) {
      const activeElement = scrollRef.current.children[activeIndex] as HTMLElement;
      if (activeElement) {
        const container = scrollRef.current;
        const elementTop = activeElement.offsetTop;
        const elementHeight = activeElement.offsetHeight;
        const containerHeight = container.clientHeight;
        const scrollPosition = elementTop - (containerHeight / 2) + (elementHeight / 2);

        container.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }
    }
  }, [activeIndex]);

  if (!lyrics || lyrics === "Searching for lyrics...") return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 bg-gradient-to-b from-black/95 via-black/90 to-black/95 backdrop-blur-3xl flex items-center justify-center"
    >
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        <div className="text-white/60 uppercase tracking-widest text-xs font-medium">Searching for lyrics...</div>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 bg-gradient-to-b from-black/95 via-black/90 to-black/95 backdrop-blur-3xl flex flex-col"
    >
      {/* Gradient overlay from cover colors */}
      {coverUrl && (
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: `linear-gradient(180deg, ${uiColor}15 0%, transparent 50%, ${uiColor}10 100%)`
          }}
        />
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-20 text-center space-y-8 scroll-smooth"
        style={{ scrollBehavior: 'smooth' }}
      >
        {parsedLines.length > 0 ? (
          parsedLines.map((line, i) => {
            const isActive = i === activeIndex;
            const isPast = i < activeIndex;
            const isFuture = i > activeIndex;

            return (
              <motion.div
                key={i}
                initial={false}
                onClick={() => onSeek(line.time)}
                animate={{
                  opacity: isActive ? 1 : isPast ? 0.4 : 0.25,
                  scale: isActive ? 1.08 : 1,
                  y: isActive ? 0 : (isPast ? -8 : 8),
                }}
                whileHover={{ scale: 1.05, opacity: 0.9 }}
                transition={{
                  duration: 0.3,
                  ease: [0.22, 1, 0.36, 1],
                  opacity: { duration: 0.2 }
                }}
                className={cn(
                  "text-3xl md:text-6xl font-bold transition-all select-none leading-tight py-3 cursor-pointer px-4",
                  isActive
                    ? "text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.5)]"
                    : "text-white/30"
                )}
                style={{
                  textShadow: isActive
                    ? `0 0 30px ${uiColor}80, 0 0 60px ${uiColor}40`
                    : undefined
                }}
              >
                {line.text}
              </motion.div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full space-y-6">
            <div className="text-2xl md:text-4xl text-white/80 leading-relaxed whitespace-pre-wrap font-medium px-8 max-w-3xl">
              {lyrics}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default function Player() {

  const {
    currentSong,
    isPlaying,
    volume,
    progress,
    duration,
    shuffle,
    repeat,
    togglePlay,
    next,
    prev,
    setVolume,
    setProgress,
    toggleShuffle,
    toggleRepeat,
    initAudio,
    isExpanded: expanded,
    setExpanded,
    sleepTimerEnd,
    setSleepTimer,
    cancelSleepTimer,
    visualizerColor,
    setVisualizerColor,
    lyrics,
    showLyrics,
    setShowLyrics,
    showDashboard,
    setShowDashboard,
    loopStartTime,
    loopEndTime,
    loopSegmentEnabled,
    setLoopStartTime,
    setLoopEndTime,
    setLoopSegmentEnabled
  } = usePlayerStore()

  const { downloadSong, removeSong, downloadedSongs, isDownloading } = useOfflineStore()

  const [muted, setMuted] = useState(false)
  const [liked, setLiked] = useState(false)
  const [localProgress, setLocalProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [visualizerMode, setVisualizerMode] = useState<'wave' | 'bar' | 'circle'>('wave')
  const [showVisualizer, setShowVisualizer] = useState(true)
  const [optionsOpen, setOptionsOpen] = useState(false);

  // Segment Loop dragging
  const [isLoopStartDragging, setIsLoopStartDragging] = useState(false)
  const [isLoopEndDragging, setIsLoopEndDragging] = useState(false)
  const [localLoopStart, setLocalLoopStart] = useState(0)
  const [localLoopEnd, setLocalLoopEnd] = useState(0)

  useEffect(() => {
    if (!isDragging) {
      setLocalProgress(progress)
    }
  }, [progress, isDragging])

  const handleSeek = (vals: number[]) => {
    setIsDragging(true)
    setLocalProgress(vals[0])
  }

  const handleSeekCommit = (vals: number[]) => {
    setIsDragging(false)
    setProgress(vals[0])
  }

  const previousVolume = useRef(volume)

  useEffect(() => {
    initAudio()
    return () => {
      usePlayerStore.getState().audio?.pause()
    }
  }, [initAudio])

  useEffect(() => {
    configureJamPlayback({
      getAudio: () => usePlayerStore.getState().audio,
      getSrcForSong: (songId: number) => {
        const downloadedSong = useOfflineStore.getState().downloadedSongs.find((song) => song.id === songId);
        if (downloadedSong?.local && downloadedSong.filePath) {
          return Capacitor.isNativePlatform()
            ? Capacitor.convertFileSrc(downloadedSong.filePath)
            : downloadedSong.filePath;
        }

        const { currentSong, queue } = usePlayerStore.getState();
        const matchedSong = currentSong?.id === songId
          ? currentSong
          : queue.find((song) => song.id === songId);

        if (!matchedSong?.audio) {
          console.error("Missing audio URL", songId);
          return "";
        }

        return matchedSong.audio;
      },
    });
  }, []);

  const lastFetched = useRef<number | null>(null);

  // Auto-fetch lyrics when song changes
  useEffect(() => {
    if (currentSong && !lyrics && currentSong.id !== lastFetched.current) {
      lastFetched.current = currentSong.id;
      const timer = setTimeout(() => {
        usePlayerStore.getState().fetchLyrics();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentSong?.id, lyrics]);

  const coverUrl = useMemo(() => {
    if (!currentSong?.cover) return null;
    if (currentSong.cover.startsWith("http")) return currentSong.cover;
    // Remove leading slash if present to avoid double slashes
    const cleanPath = currentSong.cover.startsWith('/') ? currentSong.cover.slice(1) : currentSong.cover;
    // Ensure API_URL doesn't have a trailing slash (it shouldn't, but safe to check)
    const cleanApiUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
    return `${cleanApiUrl}/covers/${cleanPath}`;
  }, [currentSong]);

  const domColor = useDominantColor(coverUrl);
  const { palette } = useCoverPalette(coverUrl, 3);

  const baseColor = (() => {
    if (visualizerColor) return null;
    if (!domColor) return { r: 255, g: 255, b: 255 };

    const brightness = (domColor.r * 299 + domColor.g * 587 + domColor.b * 114) / 1000;
    if (brightness < 80) {
      const lighten = (val: number) => Math.round(val + (255 - val) * 0.7);
      return { r: lighten(domColor.r), g: lighten(domColor.g), b: lighten(domColor.b) };
    }
    return domColor;
  })();

  const paletteColors = useMemo(() => {
    if (!palette?.length) return null;
    // Convert palette colors to rgba stops (dimmer → brighter → punchy)
    const [primary, accent, secondary] = palette;
    return [
      `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.35)`,
      `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.85)`,
      `rgba(${accent.r}, ${accent.g}, ${accent.b}, 1)`,
    ];
  }, [palette]);

  const visualizerColors = visualizerColor
    ? [`${visualizerColor}33`, `${visualizerColor}66`, `${visualizerColor}99`]
    : paletteColors
      ? paletteColors
      : baseColor
        ? [
          `rgba(${baseColor.r}, ${baseColor.g}, ${baseColor.b}, 0.3)`,
          `rgba(${Math.min(baseColor.r + 40, 255)}, ${Math.min(baseColor.g + 40, 255)}, ${Math.min(baseColor.b + 40, 255)}, 0.8)`,
          `rgba(${Math.max(baseColor.r - 40, 0)}, ${Math.max(baseColor.g - 40, 0)}, ${Math.max(baseColor.b - 40, 0)}, 1)`
        ]
        : undefined;

  const uiColor = visualizerColor || (baseColor ? `rgb(${baseColor.r}, ${baseColor.g}, ${baseColor.b})` : "#ffffff");

  useEffect(() => {
    if (!currentSong) return
    api
      .get(`/songs/${currentSong.id}/liked`)
      .then(res => setLiked(res.data.liked))
      .catch(() => setLiked(false))
  }, [currentSong])

  if (!currentSong) return null;

  const toggleLike = async () => {
    if (!currentSong) return
    try {
      if (liked) {
        await api.post(`/songs/${currentSong.id}/unlike`)
        setLiked(false)
      } else {
        await api.post(`/songs/${currentSong.id}/like`)
        setLiked(true)
      }
    } catch (e) {
      console.error("Like error", e)
    }
  }

  const handleShare = async () => {
    if (!currentSong) return;
    // Use the new smart share landing page
    const url = `${window.location.origin}/song/${currentSong.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: currentSong.title,
          text: `Check out ${currentSong.title} by ${currentSong.artist} on Krew!`,
          url: url
        })
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } catch (err) {
      console.error("Failed to share: ", err);
    }
  };

  const handleCast = () => {
    // Placeholder for casting
    toast.info("Searching for Cast devices...");
  }


  return (
    <>
      <MiniPlayerComponent
        currentSong={currentSong} coverUrl={coverUrl} uiColor={uiColor}
        isPlaying={isPlaying} togglePlay={togglePlay} next={next} prev={prev}
        setExpanded={setExpanded}
      />
      <ExpandedPlayerComponent
        currentSong={currentSong} coverUrl={coverUrl} uiColor={uiColor}
        isPlaying={isPlaying} progress={progress} duration={duration}
        togglePlay={togglePlay} next={next} prev={prev}
        shuffle={shuffle} repeat={repeat} toggleShuffle={toggleShuffle} toggleRepeat={toggleRepeat}
        showLyrics={showLyrics} setShowLyrics={setShowLyrics}
        showDashboard={showDashboard} setShowDashboard={setShowDashboard}
        visualizerColors={visualizerColors} visualizerMode={visualizerMode}
        showVisualizer={showVisualizer} handleSeek={handleSeek} handleSeekCommit={handleSeekCommit}
        isDragging={isDragging} localProgress={localProgress}
        handleShare={handleShare} handleCast={handleCast}
        expanded={expanded} setExpanded={setExpanded}
        liked={liked} toggleLike={toggleLike} lyrics={lyrics}
      />
    </>
  )
}

// Memoized Mini Player
const MiniPlayerComponent = memo(({
  currentSong, coverUrl, uiColor, isPlaying, togglePlay, next, prev, setExpanded
}: any) => {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1, x: 0 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x < -100) next();
        else if (info.offset.x > 100) prev();
      }}
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-2 right-2 md:left-4 md:right-4 md:bottom-4 h-[72px] z-40 rounded-[16px] flex items-center px-4 overflow-hidden cursor-grab active:cursor-grabbing"
      style={{
        background: 'rgba(30, 30, 30, 0.6)',
        backdropFilter: 'blur(20px)',
        boxShadow: `0 -1px 0 rgba(255,255,255,0.1), 0 4px 20px rgba(0,0,0,0.4)`
      }}
      dragDirectionLock
      onClick={() => setExpanded(true)}
    >
      {/* Mesh Gradient Background - Subtle */}
      {uiColor && (
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: `linear-gradient(90deg, ${uiColor}30 0%, transparent 100%)`
          }}
        />
      )}



      <div className="h-12 w-12 rounded-[8px] overflow-hidden shrink-0 relative mr-4 shadow-lg">
        {coverUrl ? (
          <img src={coverUrl} alt={currentSong.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[#282828] flex items-center justify-center text-xs">♪</div>
        )}
      </div>

      <div className="flex-1 min-w-0 mr-4 flex flex-col justify-center">
        <h4 className="font-bold text-[15px] text-white truncate leading-snug">{currentSong.title}</h4>
        <p className="text-[13px] text-white/60 truncate font-medium">{currentSong.artist}</p>
      </div>

      <div className="flex items-center gap-4 z-10 pr-1">
        <button
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all backdrop-blur-md"
        >
          {isPlaying ? <Pause className="h-5 w-5 fill-white text-white" /> : <Play className="h-5 w-5 fill-white text-white ml-0.5" />}
        </button>
      </div>
    </motion.div>
  )
});

// Memoized Expanded Player
const ExpandedPlayerComponent = memo(({
  currentSong, coverUrl, uiColor, isPlaying, progress, duration,
  togglePlay, next, prev, shuffle, repeat, toggleShuffle, toggleRepeat,
  showLyrics, setShowLyrics,
  showDashboard, setShowDashboard, visualizerColors, visualizerMode,
  showVisualizer, handleSeek, handleSeekCommit, isDragging, localProgress,
  handleShare, handleCast, expanded, setExpanded, liked, toggleLike, lyrics
}: any) => {

  const { downloadSong, removeSong, downloadedSongs, isDownloading } = useOfflineStore()
  const downloadedStatus = currentSong ? downloadedSongs.some(s => s.id === currentSong.id) : false;
  const downloadingStatus = currentSong ? isDownloading[currentSong.id] : false;

  const {
    loopStartTime, loopEndTime, loopSegmentEnabled,
    setLoopStartTime, setLoopEndTime, setLoopSegmentEnabled
  } = usePlayerStore()

  const [isLoopStartDragging, setIsLoopStartDragging] = useState(false)
  const [isLoopEndDragging, setIsLoopEndDragging] = useState(false)
  const [localLoopStart, setLocalLoopStart] = useState(0)
  const [localLoopEnd, setLocalLoopEnd] = useState(0)
  const [initialLoopStart, setInitialLoopStart] = useState(0)
  const [initialLoopEnd, setInitialLoopEnd] = useState(0)
  const progressBarRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isLoopStartDragging) setLocalLoopStart(loopStartTime);
    if (!isLoopEndDragging) setLocalLoopEnd(loopEndTime);
  }, [loopStartTime, loopEndTime, isLoopStartDragging, isLoopEndDragging]);

  const startLoopDrag = (event: React.PointerEvent<HTMLDivElement>, handle: 'start' | 'end') => {
    event.preventDefault();
    event.stopPropagation();

    const originalStart = loopStartTime;
    const originalEnd = loopEndTime;
    const isStart = handle === 'start';

    if (isStart) {
      setIsLoopStartDragging(true);
      setInitialLoopStart(loopStartTime);
    } else {
      setIsLoopEndDragging(true);
      setInitialLoopEnd(loopEndTime);
    }

    let frameId: number;
    let lastPercentage = -1;

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!progressBarRef.current || duration === undefined) return;
      const rect = progressBarRef.current.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));

      if (percentage === lastPercentage) return;
      lastPercentage = percentage;

      if (frameId) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        const rawTime = percentage * duration;
        const snapped = Math.round(rawTime * 10) / 10;

        if (isStart) {
          const clampedStart = Math.min(Math.max(0, snapped), Math.max(0, originalEnd - 0.5));
          setLocalLoopStart(clampedStart);
          setLoopStartTime(clampedStart);
          // Immediate audio jump for start handle
          handleSeekCommit([clampedStart]);
        } else {
          const clampedEnd = Math.min(Math.max(originalStart + 0.5, snapped), duration);
          setLocalLoopEnd(clampedEnd);
          setLoopEndTime(clampedEnd);
        }
      });
    };

    const onPointerUp = () => {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (isStart) setIsLoopStartDragging(false);
      else setIsLoopEndDragging(false);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };


  return (
    <AnimatePresence>
      {expanded && (
        <motion.div
          key="expanded"
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.4 }} // Only pull down
          onDragEnd={(_, info) => {
            if (info.offset.y > 100 || info.velocity.y > 300) {
              setExpanded(false);
            }
          }}
          className="fixed inset-0 z-50 flex flex-col bg-[#050505] pt-safe"
        >
          {/* BACKGROUND - Blurred Cover Image */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-black" />
            {coverUrl && (
              <motion.img
                key={coverUrl}
                src={coverUrl}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ duration: 1 }}
                className="w-full h-full object-cover blur-[80px] scale-125 opacity-50"
              />
            )}
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
          </div>

          {/* VISUALIZER - Matches Desktop (Clean) */}
          {showVisualizer && visualizerColors && !showDashboard && (
            <Visualizer
              className="absolute bottom-0 left-0 w-full h-[90%] pointer-events-none z-0"
              colors={visualizerColors}
              mode={visualizerMode}
            />
          )}

          {/* DASHBOARD OVERLAY */}
          <AnimatePresence>
            {showDashboard && (
              <>
                {/* 🔥 BACKGROUND DIM LAYER */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 bg-black/50 backdrop-blur-sm z-[55]"
                  onClick={() => setShowDashboard(false)}
                />

                {/* 🎧 BOTTOM SHEET */}
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 25, stiffness: 250 }}
                  drag={!showDashboard ? "y" : false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ bottom: 0.3 }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onDragEnd={(_, info) => {
                    if (info.offset.y > 120 || info.velocity.y > 500) {
                      setShowDashboard(false);
                    }
                  }}
                  className="
                    absolute bottom-0 left-0 right-0 
                    h-[min(75%, 500px)] z-[60] 
                    bg-[#0a0a0a]/95 backdrop-blur-2xl
                    rounded-t-3xl border-t border-white/10
                    shadow-[0_-20px_60px_rgba(0,0,0,0.9)]
                    flex flex-col
                  "
                >
                  {/* 🧲 HANDLE BAR */}
                  <div className="w-10 h-1 bg-white/20 rounded-full mx-auto my-3" />

                  {/* 📀 DASHBOARD CONTENT */}
                  <div className="flex-1 overflow-hidden pb-4">
                    <AudioDashboard
                      className="w-full h-full"
                      color={uiColor}
                      onClose={() => setShowDashboard(false)}
                    />
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* LYRICS OVERLAY - Modern Design */}
          <AnimatePresence>
            {showLyrics && (
              <LyricsOverlay
                lyrics={lyrics}
                progress={progress}
                onSeek={handleSeekCommit}
                coverUrl={coverUrl}
                uiColor={uiColor}
              />
            )}
          </AnimatePresence>

          {/* Lyrics Close Button - Floating */}
          {showLyrics && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => setShowLyrics(false)}
              className="fixed top-4 right-4 z-[60] p-3 rounded-full bg-black/50 backdrop-blur-xl hover:bg-black/70 transition-colors border border-white/10"
            >
              <X className="h-5 w-5 text-white" />
            </motion.button>
          )}

          {/* CONTENT CONTAINER - Flex Column */}
          <div
            className="
              relative z-20 flex flex-col h-full min-h-0 w-full
              px-4 sm:px-6
              pt-4
              pb-[calc(1rem+env(safe-area-inset-bottom))]
            "
          >

            {/* 1. TOP BAR - Drag Handle Only */}
            <div className={cn("flex items-center justify-center h-8 shrink-0 w-full transition-all duration-300",
              (isLoopStartDragging || isLoopEndDragging) && "blur-sm opacity-50 pointer-events-none"
            )}>
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Scrollable main content (only when space is tight) */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="w-full min-h-0 flex flex-col items-center gap-6 sm:gap-8 py-3">

                {/* 2. ARTWORK */}
                <div className={cn("w-full flex items-center justify-center min-h-0 relative transition-all duration-300",
                  (isLoopStartDragging || isLoopEndDragging) && "blur-md opacity-40 pointer-events-none"
                )}>
                  <motion.div
                    className="
                      relative aspect-square w-full
                      max-w-[280px] sm:max-w-[320px] md:max-w-[360px] lg:max-w-[380px] xl:max-w-[420px]
                      max-h-[50vh]
                      rounded-[18px] z-10
                    "
                    style={{
                      boxShadow: `0 10px 40px -10px ${uiColor}50`
                    }}
                    animate={{
                      scale: isPlaying ? 1.02 : 1,
                    }}
                    transition={{
                      duration: 0.5,
                      ease: "easeOut"
                    }}
                  >
                    <div className="absolute inset-0 rounded-[18px] overflow-hidden bg-[#282828] border border-white/5">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt={currentSong.title}
                          className="w-full h-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-6xl text-white/20">♪</div>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* 3. TRACK INFO & CONTROLS */}
                <div className="w-full max-w-[420px] shrink-0 flex flex-col gap-5 sm:gap-6">

                  {/* Title & More Button Row */}
                  <div className={cn("flex items-center justify-between px-1 transition-all duration-300",
                    (isLoopStartDragging || isLoopEndDragging) && "blur-sm opacity-50 pointer-events-none"
                  )}>
                    <div className="flex flex-col text-left overflow-hidden mr-4 min-w-0 flex-1">
                      <h2 className="text-[20px] sm:text-[22px] font-bold text-white truncate leading-tight tracking-tight">
                        {currentSong.title}
                      </h2>
                      <p className="text-[16px] sm:text-[18px] text-white/60 truncate font-medium mt-1">
                        {currentSong.artist}
                      </p>
                    </div>

                    {/* LIKE & DOWNLOAD BUTTONS */}
                    <div className="flex flex-row items-center justify-end gap-1">
                      {!downloadedStatus ? (
                        <button
                          onClick={() => currentSong && downloadSong(currentSong)}
                          disabled={downloadingStatus}
                          className={cn("p-2 transition-transform active:scale-90", downloadingStatus ? "text-[#3b82f6]" : "text-white/50 hover:text-white")}
                        >
                          {downloadingStatus ? <Loader2 className="h-6 w-6 animate-spin" /> : <Download className="h-6 w-6" />}
                        </button>
                      ) : (
                        <button
                          onClick={() => currentSong && removeSong(currentSong.id)}
                          className="p-2 text-[#3b82f6] transition-transform hover:scale-105 active:scale-95"
                        >
                          <CheckCircle2 className="h-6 w-6" />
                        </button>
                      )}

                      <button
                        onClick={toggleLike}
                        className="p-2 transition-transform active:scale-90"
                      >
                        <Heart
                          className={cn(
                            "h-7 w-7 transition-colors drop-shadow-md",
                            liked ? "fill-white text-white" : "text-white/50 hover:text-white"
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Progress - White Bar & Loop Track */}
                  <div className="relative z-30">
                    <div
                      ref={progressBarRef}
                      className="relative h-10 flex flex-col justify-center group touch-none px-0"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {loopSegmentEnabled && duration && (
                        <>
                          {/* Loop Range Highlight */}
                          <div
                            className="absolute top-1/2 h-2 rounded-full bg-white/10 -translate-y-1/2 transition-all pointer-events-none"
                            style={{
                              left: `${(loopStartTime / duration) * 100}%`,
                              width: `${((loopEndTime - loopStartTime) / duration) * 100}%`
                            }}
                          />

                          {/* Start Handle Wrapper */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-40 pointer-events-none"
                            style={{
                              left: `clamp(16px, ${(isLoopStartDragging ? localLoopStart : loopStartTime) / duration * 100}%, calc(100% - 16px))`
                            }}
                          >
                            {/* Label */}
                            <div className={cn(
                              "absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-bold tracking-[0.2em] text-white/40 transition-opacity whitespace-nowrap",
                              isLoopStartDragging ? "opacity-0" : "opacity-100"
                            )}>
                              START
                            </div>

                            {/* Interactive Handle */}
                            <motion.div
                              className="cursor-ew-resize group/handle p-2 flex items-center justify-center pointer-events-auto"
                              onPointerDown={(e) => startLoopDrag(e, 'start')}
                              whileHover={{ scale: 1.2 }}
                              whileDrag={{ scale: 1.4 }}
                            >
                              <div className={cn(
                                "w-3 h-3 bg-blue-400 rounded-full transition-shadow shadow-[0_0_8px_rgba(96,165,250,0.6)] border border-white/20",
                                isLoopStartDragging && "brightness-125 shadow-[0_0_12px_rgba(96,165,250,0.8)] border-white/40"
                              )} />
                            </motion.div>

                            {/* Tooltip */}
                            <AnimatePresence>
                              {isLoopStartDragging && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                  className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md border border-white/20 whitespace-nowrap font-mono shadow-xl flex flex-col items-center pointer-events-none"
                                >
                                  <span>{formatTime(localLoopStart)}</span>
                                  <span className="text-[9px] opacity-60">
                                    {localLoopStart - initialLoopStart >= 0 ? '+' : ''}{(localLoopStart - initialLoopStart).toFixed(1)}s
                                  </span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* End Handle Wrapper */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-40 pointer-events-none"
                            style={{
                              left: `clamp(16px, ${(isLoopEndDragging ? localLoopEnd : loopEndTime) / duration * 100}%, calc(100% - 16px))`
                            }}
                          >
                            {/* Label */}
                            <div className={cn(
                              "absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] font-bold tracking-[0.2em] text-white/40 transition-opacity whitespace-nowrap",
                              isLoopEndDragging ? "opacity-0" : "opacity-100"
                            )}>
                              END
                            </div>

                            {/* Interactive Handle */}
                            <motion.div
                              className="cursor-ew-resize group/handle p-2 flex items-center justify-center pointer-events-auto"
                              onPointerDown={(e) => startLoopDrag(e, 'end')}
                              whileHover={{ scale: 1.2 }}
                              whileDrag={{ scale: 1.4 }}
                            >
                              <div className={cn(
                                "w-3 h-3 bg-red-400 rounded-full transition-shadow shadow-[0_0_8px_rgba(248,113,113,0.6)] border border-white/20",
                                isLoopEndDragging && "brightness-125 shadow-[0_0_12px_rgba(248,113,113,0.8)] border-white/40"
                              )} />
                            </motion.div>

                            {/* Tooltip */}
                            <AnimatePresence>
                              {isLoopEndDragging && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                  className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md border border-white/20 whitespace-nowrap font-mono shadow-xl flex flex-col items-center pointer-events-none"
                                >
                                  <span>{formatTime(localLoopEnd)}</span>
                                  <span className="text-[9px] opacity-60">
                                    {localLoopEnd - initialLoopEnd >= 0 ? '+' : ''}{(localLoopEnd - initialLoopEnd).toFixed(1)}s
                                  </span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </>
                      )}

                      <Slider
                        defaultValue={[0]}
                        value={[isDragging ? localProgress : progress]}
                        max={duration || 100}
                        step={1}
                        onValueChange={handleSeek}
                        onValueCommit={handleSeekCommit}
                        className="px-4 cursor-pointer h-3 flex items-center relative z-20"
                        color="#ffffff"
                      />
                    </div>
                    <div className="flex justify-between text-[11px] font-medium text-white/40 mt-1 tabular-nums font-mono">
                      <span>{formatTime(isDragging ? localProgress : progress)}</span>
                      <span>-{formatTime((duration || 0) - (isDragging ? localProgress : progress))}</span>
                    </div>
                  </div>

                  {/* Main Controls - Shuffle, Prev, Play, Next, Repeat */}
                  <div className={cn("flex items-center justify-between px-2 transition-all duration-300",
                    (isLoopStartDragging || isLoopEndDragging) && "blur-sm opacity-50 pointer-events-none"
                  )}>
                    <button
                      onClick={toggleShuffle}
                      className={cn(
                        "p-2 transition-all active:scale-90",
                        shuffle
                          ? "text-white"
                          : "text-white/30"
                      )}
                      style={shuffle ? { filter: `drop-shadow(0 0 8px ${uiColor})` } : undefined}
                    >
                      <Shuffle className="h-6 w-6" />
                    </button>

                    <button
                      onClick={prev}
                      className="text-white/90 hover:text-white active:scale-90 transition-transform"
                    >
                      <SkipBack className="h-10 w-10 fill-current" />
                    </button>

                    <button
                      onClick={togglePlay}
                      className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-white active:scale-95 transition-transform"
                    >
                      {isPlaying ? (
                        <Pause className="h-[72px] w-[72px] fill-current" />
                      ) : (
                        <Play className="h-[72px] w-[72px] fill-current" />
                      )}
                    </button>

                    <button
                      onClick={next}
                      className="text-white/90 hover:text-white active:scale-90 transition-transform"
                    >
                      <SkipForward className="h-10 w-10 fill-current" />
                    </button>

                    <button
                      onClick={toggleRepeat}
                      className={cn(
                        "p-2 transition-all active:scale-90",
                        repeat !== 'off'
                          ? "text-white"
                          : "text-white/30"
                      )}
                      style={repeat !== 'off' ? { filter: `drop-shadow(0 0 8px ${uiColor})` } : undefined}
                    >
                      {repeat === 'one' ? (
                        <Repeat1 className="h-6 w-6" />
                      ) : (
                        <Repeat className="h-6 w-6" />
                      )}
                    </button>
                  </div>

                  <div className={cn("space-y-3 transition-all duration-300",
                    (isLoopStartDragging || isLoopEndDragging) && "blur-sm opacity-50 pointer-events-none"
                  )}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <button
                        onClick={() => setLoopSegmentEnabled(!loopSegmentEnabled)}
                        className={cn(
                          "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors",
                          loopSegmentEnabled
                            ? "bg-white/15 text-white border border-white/10"
                            : "bg-white/5 text-white/70 hover:text-white"
                        )}
                      >
                        <ListRestart className="w-4 h-4" />
                        {loopSegmentEnabled ? 'Loop ON' : 'Loop OFF'}
                      </button>

                      <div className="text-sm text-white/60 font-medium tabular-nums">
                        {loopSegmentEnabled
                          ? `${formatTime(loopStartTime)} → ${formatTime(loopEndTime)}`
                          : 'Loop range disabled'}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Actions: Lyrics, Airplay, List */}
                  <div className={cn("flex justify-center pt-2 pb-2 transition-all duration-300",
                    (isLoopStartDragging || isLoopEndDragging) && "blur-sm opacity-50 pointer-events-none"
                  )}>
                    <div
                      className="
                flex items-center justify-between gap-6
                px-6 py-3
                rounded-2xl
                bg-white/5 backdrop-blur-2xl
                border border-white/10
                shadow-[0_8px_30px_rgba(0,0,0,0.3)]
              "
                    >
                      <button
                        onClick={() => setShowLyrics(!showLyrics)}
                        className={cn(
                          "p-3 rounded-xl transition-colors",
                          showLyrics
                            ? "bg-white/20 text-white"
                            : "text-white/50 hover:text-white"
                        )}
                      >
                        <Mic2 className="h-6 w-6" />
                      </button>

                      <button
                        onClick={handleShare}
                        className="p-3 text-white/50 hover:text-white transition-colors"
                      >
                        <Share2 className="h-6 w-6" />
                      </button>

                      <button
                        onClick={handleCast}
                        className="p-3 text-white/50 hover:text-white transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-6 w-6"
                        >
                          <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
                          <line x1="2" x2="2.01" y1="20" y2="20" />
                        </svg>
                      </button>

                      <button
                        onClick={() => {
                          setShowDashboard(!showDashboard);
                          if (!showDashboard) setShowLyrics(false);
                        }}
                        className={cn(
                          "p-3 rounded-xl transition-colors",
                          showDashboard
                            ? "bg-white/20 text-white"
                            : "text-white/50 hover:text-white"
                        )}
                      >
                        <ListMusic className="h-6 w-6" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div >
      )
      }
    </AnimatePresence >
  )
});
