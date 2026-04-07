import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Check } from "lucide-react"
import { playlistsApi } from "@/lib/api"

interface Playlist {
  id: number
  name: string
}

interface Props {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  songId: number
  onSongAdded?: () => void
}

export default function AddToPlaylistModal({
  isOpen,
  onOpenChange,
  songId,
  onSongAdded,
}: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(false)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [addedIds, setAddedIds] = useState<number[]>([])
  const { toast } = useToast()

  /* ================= FETCH PLAYLISTS ================= */
  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    setAddedIds([])

    playlistsApi
      .getAll()
      .then((res) => {
        const data = res.data
        if (Array.isArray(data)) {
          setPlaylists(data)
        } else {
          setPlaylists([])
        }
      })
      .catch(() => {
        setPlaylists([])
      })
      .finally(() => setLoading(false))
  }, [isOpen])

  /* ================= ADD SONG ================= */
  const addToPlaylist = async (playlistId: number) => {
    if (addedIds.includes(playlistId)) return

    setAddingId(playlistId)

    try {
      await playlistsApi.addSong(playlistId, songId)

      setAddedIds((prev) => [...prev, playlistId])

      toast({
        title: "Added to playlist",
      })

      onSongAdded?.()
    } catch (error) {
      toast({
        title: "Failed to add",
        description: "Try again",
        variant: "destructive",
      })
    } finally {
      setAddingId(null)
    }
  }

  /* ================= RENDER ================= */
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-sm"
      >
        <DialogHeader>
          <DialogTitle>Add to playlist</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : playlists.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No playlists found
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {playlists.map((playlist) => {
              const added = addedIds.includes(playlist.id)

              return (
                <button
                  key={playlist.id}
                  onClick={() => addToPlaylist(playlist.id)}
                  disabled={addingId === playlist.id || added}
                  className="w-full flex items-center justify-between
                             rounded-md px-3 py-2 text-left
                             hover:bg-secondary transition
                             disabled:opacity-60"
                >
                  <span>{playlist.name}</span>

                  {added && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </button>
              )
            })}
          </div>
        )}

        <Button
          variant="outline"
          className="mt-4"
          onClick={() => onOpenChange(false)}
        >
          Close
        </Button>
      </DialogContent>
    </Dialog>
  )
}
