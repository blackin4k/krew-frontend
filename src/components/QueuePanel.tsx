import { useEffect, useState, useRef } from "react"
import { playerApi } from "@/lib/api"
import { normalizeQueueResponse } from "@/lib/queue"
import { Play, Shuffle, History, ListMusic, Sparkles, Trash2, SkipForward, GripVertical } from "lucide-react"
import { usePlayerStore } from "@/stores/playerStore"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Reorder, useDragControls } from "framer-motion"

export default function QueuePanel() {
  const [queue, setQueue] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const { playSong } = usePlayerStore()
  const isReordering = useRef(false)

  const fetchQueue = () => {
    // Only fetch if not currently dragging/reordering to avoid jumping
    if (!isReordering.current) {
      playerApi.queue()
        .then(res => setQueue(normalizeQueueResponse(res.data).queue))
        .catch(err => console.error(err))
    }
  }

  const fetchHistory = () => {
    playerApi.getHistory().then(res => setHistory(res.data || [])).catch(err => console.error(err))
  }

  useEffect(() => {
    fetchQueue()
    // Poll queue occasionally or rely on other triggers? 
    const interval = setInterval(fetchQueue, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleSmartShuffle = async () => {
    try {
      const res = await playerApi.smartShuffle()
      toast.success(res.data.msg)
      fetchQueue()
    } catch (e) {
      toast.error("Failed to shuffle")
    }
  }

  const handleRemoveSong = async (songId: number) => {
    try {
      // Optimistic update
      const newQueue = queue.filter(s => s.id !== songId)
      setQueue(newQueue)

      await playerApi.modifyQueue('remove', { song_ids: [songId] })
      toast.success('Song removed')
    } catch (e) {
      toast.error('Failed to remove song')
      fetchQueue() // Revert on fail
    }
  }

  const handlePlayNext = async (songId: number) => {
    try {
      await playerApi.modifyQueue('play_next', { song_id: songId })
      toast.success('Playing next')
      fetchQueue()
    } catch (e) {
      toast.error('Failed to update queue')
    }
  }

  const handleClearQueue = async () => {
    if (!confirm('Clear entire queue?')) return
    try {
      setQueue([])
      await playerApi.modifyQueue('clear', {})
      toast.success('Queue cleared')
    } catch (e) {
      toast.error('Failed to clear queue')
    }
  }

  const handleReorder = (newOrder: any[]) => {
    setQueue(newOrder)
    isReordering.current = true
  }

  const handleReorderEnd = async () => {
    isReordering.current = false
    try {
      const songIds = queue.map(s => s.id)
      await playerApi.modifyQueue('reorder', { song_ids: songIds })
    } catch (e) {
      console.error("Reorder failed", e)
      toast.error("Failed to save order")
      fetchQueue()
    }
  }

  const SongItem = ({ song, isHistory = false, index, dragControls }: { song: any, isHistory?: boolean, index?: number, dragControls?: any }) => (
    <div className={cn(
      "flex items-center justify-between p-2 rounded-md hover:bg-white/5 group transition-colors relative bg-[#09090b]",
      !isHistory && "cursor-grab active:cursor-grabbing border border-transparent hover:border-white/5"
    )}>
      {/* Drag Handle */}
      {!isHistory && (
        <div className="mr-2 text-white/20 hover:text-white/60 cursor-grab active:cursor-grabbing" onPointerDown={(e) => dragControls?.start(e)}>
          <GripVertical className="h-4 w-4" />
        </div>
      )}

      <div className="flex-1 min-w-0 pr-4">
        <p className={cn("truncate font-medium text-[14px]", isHistory && "text-muted-foreground")}>{song.title}</p>
        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>

        {isHistory && song.played_at && (
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">
            {new Date(song.played_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isHistory && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handlePlayNext(song.id)}
              className="h-7 w-7 p-0"
              title="Play Next"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleRemoveSong(song.id)}
              className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => playSong(song)}
          className="h-7 w-7 p-0"
          title="Play"
        >
          <Play className="h-3.5 w-3.5 fill-white text-white" />
        </Button>
      </div>
    </div>
  )

  // Wrapper for Reorder Item logic
  const DraggableSongItem = ({ song, index }: { song: any, index: number }) => {
    const controls = useDragControls()
    return (
      <Reorder.Item
        value={song}
        id={song.id}
        dragListener={false}
        dragControls={controls}
        onDragEnd={handleReorderEnd}
        className="select-none"
      >
        <SongItem song={song} index={index} dragControls={controls} />
      </Reorder.Item>
    )
  }

  return (
    <div className="h-full flex flex-col bg-black/40 backdrop-blur-xl border-l border-white/5">
      <div className="p-4 border-b border-white/5">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <ListMusic className="h-5 w-5" />
          Queue
        </h2>

        <Tabs defaultValue="queue" className="w-full" onValueChange={(val) => {
          if (val === 'history') fetchHistory()
          else fetchQueue()
        }}>
          <TabsList className="w-full grid grid-cols-2 bg-white/5">
            <TabsTrigger value="queue">Up Next</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="flex-1 h-full mt-4">
            <div className="flex justify-between items-center mb-2">
              {queue.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearQueue}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Clear All
                </Button>
              )}
              <button
                onClick={handleSmartShuffle}
                className="text-xs flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 transition-colors"
                disabled={queue.length === 0}
              >
                <Sparkles className="h-3 w-3" />
                Smart Shuffle
              </button>
            </div>
            <ScrollArea className="h-[calc(100vh-250px)] pr-4">
              {queue.length === 0 ? (
                <div className="text-center text-muted-foreground py-10 text-sm">
                  Queue is empty
                </div>
              ) : (
                <Reorder.Group axis="y" values={queue} onReorder={handleReorder} className="flex flex-col gap-1">
                  {queue.map((song, i) => (
                    <DraggableSongItem key={song.id || i} song={song} index={i} />
                  ))}
                </Reorder.Group>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history" className="flex-1 h-full mt-4">
            <ScrollArea className="h-[calc(100vh-200px)] pr-4">
              {history.length === 0 ? (
                <div className="text-center text-muted-foreground py-10 text-sm">
                  No history yet
                </div>
              ) : (
                <div className="space-y-1">
                  {history.map((song, i) => (
                    <SongItem key={`${song.id}-${i}`} song={song} isHistory />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
