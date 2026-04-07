import React, { useState } from "react"
import { toast } from "sonner"
import AddToPlaylistModal from "@/components/AddToPlaylistModal"
import { MoreVertical, Play, Pause, Heart, Plus, Radio, Download, Check, Loader2 } from "lucide-react"
import { motion } from "framer-motion"
import { Song } from "@/types/music"
import { usePlayerStore } from "@/stores/playerStore"
import { useOfflineStore } from "@/stores/offlineStore"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface SongCardProps {
  song: Song
  index?: number
  showIndex?: boolean
  compact?: boolean
  variant?: 'grid' | 'list'
  onSongAdded?: () => void
  onBecauseYouListened?: (songId: number, title: string) => void
}

import { API_URL } from "@/lib/api"

const SongCard = ({ song, index, showIndex, compact, variant = 'grid', onSongAdded, onBecauseYouListened }: SongCardProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { currentSong, isPlaying, playSong, togglePlay } = usePlayerStore()
  const { downloadSong, isDownloaded, removeSong, isDownloading } = useOfflineStore()
  
  const isCurrentSong = currentSong?.id === song.id
  const downloaded = isDownloaded(song.id)
  const downloading = isDownloading[song.id]


  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isCurrentSong) togglePlay()
    else playSong(song)
  }

  const handleAddToPlaylist = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsModalOpen(true)
  }

  const coverUrl = song.cover
    ? song.cover.startsWith("http")
      ? song.cover
      : `${API_URL}${API_URL.endsWith('/') ? '' : '/'}/covers/${song.cover.startsWith('/') ? song.cover.slice(1) : song.cover}`
    : null

  if (compact) {
    // SPOTIFY STYLE "JUMP BACK IN" CARD (Tiny Grid Item)
    // 48/56px height, rounded-sm
    return (
      <>
        <div
          className={cn(
            "group flex items-center h-14 rounded-md bg-[#282828]/50 hover:bg-[#3E3E3E] transition-colors overflow-hidden pr-2 cursor-pointer shadow-sm relative",
            isCurrentSong && "bg-[#3E3E3E]"
          )}
          onClick={handlePlay}
        >
          {/* Cover - Full height docked left */}
          <div className="h-full w-14 shrink-0 relative bg-[#181818]">
            {coverUrl ? (
              <img src={coverUrl} alt={song.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-white/30">♪</div>
            )}
            {/* Overlay Play Icon (Always visible on current, or hover) */}
            {(isCurrentSong || isPlaying) && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                {isPlaying && isCurrentSong ? (
                  <div className="flex gap-1">
                    <div className="w-1 h-3 bg-[#3b82f6] animate-[bounce_1s_infinite]" />
                    <div className="w-1 h-3 bg-[#3b82f6] animate-[bounce_1s_infinite_0.1s]" />
                    <div className="w-1 h-3 bg-[#3b82f6] animate-[bounce_1s_infinite_0.2s]" />
                  </div>
                ) : (
                  <Play className="h-5 w-5 fill-white text-white" />
                )}
              </div>
            )}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0 px-3 flex flex-col justify-center">
            <h4 className={cn("font-bold text-[13px] leading-tight truncate", isCurrentSong ? "text-[#3b82f6]" : "text-white")}>
              {song.title}
            </h4>
          </div>
        </div>

        <AddToPlaylistModal
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          songId={song.id}
          onSongAdded={onSongAdded}
        />
      </>
    )
  }

  // LIST VARIANT (Clean list-item)
  if (variant === 'list') {
    return (
      <>
        <div
          onClick={handlePlay}
          className={cn(
            "group flex items-center gap-3 p-2 rounded-md active:bg-[#282828] hover:bg-[#181818] transition-colors w-full cursor-pointer",
            isCurrentSong && "bg-[#181818]"
          )}
        >
          {/* Cover - 48px standard */}
          <div className="relative h-12 w-12 shrink-0 rounded-[4px] overflow-hidden bg-[#282828]">
            {coverUrl ? (
              <img src={coverUrl} alt={song.title} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-white/20">♪</div>
            )}

            {/* Overlay Play Icon */}
            <div className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 ${isCurrentSong ? 'opacity-100' : ''}`}>
              {isPlaying && isCurrentSong ? (
                <Pause className="h-5 w-5 fill-white text-white" />
              ) : (
                <Play className="h-5 w-5 fill-white text-white" />
              )}
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <h4 className={cn("font-medium text-[16px] truncate leading-tight", isCurrentSong ? "text-[#3b82f6]" : "text-white")}>
              {song.title}
            </h4>
            <div className="flex items-center gap-1 mt-0.5">
              {/* Explicit badge placeholder if needed */}
              {/* <span className="bg-[#B3B3B3] text-black text-[9px] px-1 rounded-sm font-bold">E</span> */}
              <p className="text-[14px] text-[#B3B3B3] truncate">{song.artist}</p>
            </div>
          </div>

          {/* More Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <button className="p-3 text-[#B3B3B3] hover:text-white transition-colors">
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-[#282828] border-none text-white shadow-xl p-1.5 rounded-lg">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); usePlayerStore.getState().playRadio(song.id); }} className="hover:bg-[#3E3E3E] rounded-sm focus:bg-[#3E3E3E] cursor-pointer">
                <Radio className="w-4 h-4 mr-3" /> Go to Song Radio
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleAddToPlaylist} className="hover:bg-[#3E3E3E] rounded-sm focus:bg-[#3E3E3E] cursor-pointer">
                <Plus className="w-4 h-4 mr-3" /> Add to Playlist
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (downloaded) {
                    removeSong(song.id);
                  } else {
                    downloadSong(song);
                  }
                }} 
                disabled={downloading}
                className="hover:bg-[#3E3E3E] rounded-sm focus:bg-[#3E3E3E] cursor-pointer"
              >
                {downloading ? <Loader2 className="w-4 h-4 mr-3 animate-spin text-[#3b82f6]" /> : 
                 downloaded ? <Check className="w-4 h-4 mr-3 text-[#3b82f6]" /> : 
                 <Download className="w-4 h-4 mr-3" />}
                {downloading ? "Downloading..." : downloaded ? "Downloaded" : "Download"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); }} className="hover:bg-[#3E3E3E] rounded-sm focus:bg-[#3E3E3E] cursor-pointer">
                <Heart className="w-4 h-4 mr-3" /> Like (Coming Soon)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <AddToPlaylistModal
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          songId={song.id}
          onSongAdded={onSongAdded}
        />
      </>
    )
  }

  // DEFAULT GRID CARD - 160px width strict
  return (
    <>
      <div
        className={cn(
          "group relative rounded-[12px] bg-[#181818] p-4 pb-6 hover:bg-[#282828] transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden card-elevated cursor-pointer",
          isCurrentSong ? "bg-[#282828]" : ""
        )}
        style={{ width: '160px' }} // Strict width
        onClick={handlePlay}
      >
        {/* COVER */}
        <div className="aspect-square relative overflow-hidden rounded-[8px] mb-4 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={song.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[#282828] flex items-center justify-center text-4xl text-[#B3B3B3]">
              ♪
            </div>
          )}

          {/* PLAY BUTTON OVERLAY - Floating Green Button */}
          <div
            className="absolute bottom-2 right-2 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-[0_8px_8px_rgba(0,0,0,0.3)] z-20"
          >
            <div className="h-12 w-12 rounded-full bg-[#3b82f6] text-black flex items-center justify-center hover:scale-105 active:scale-95 active:bg-[#60a5fa] transition-transform">
              {isCurrentSong && isPlaying ? (
                <Pause className="h-6 w-6 fill-black" />
              ) : (
                <Play className="h-6 w-6 fill-black ml-1" />
              )}
            </div>
          </div>
        </div>


        {/* TEXT */}
        <div className="flex flex-col gap-1">
          <h3 className={cn("font-bold truncate text-[16px] leading-tight", isCurrentSong ? "text-[#3b82f6]" : "text-white")}>
            {song.title}
          </h3>
          <p className="text-[14px] text-[#B3B3B3] truncate line-clamp-2 leading-tight">
            {/* Use line-clamp-2 for description/artist to match Spotify cards */}
            {song.artist}
          </p>
        </div>
      </div>

      <AddToPlaylistModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        songId={song.id}
        onSongAdded={onSongAdded}
      />
    </>
  )
}

export default React.memo(SongCard)