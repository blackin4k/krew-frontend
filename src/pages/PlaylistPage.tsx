import { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Play,
  MoreHorizontal,
  Trash2,
  Music,
  GripVertical,
} from "lucide-react"
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { playlistsApi, API_URL } from "@/lib/api"
import { usePlayerStore } from "@/stores/playerStore"
import AddSongsToPlaylistDialog from "@/components/AddSongsToPlaylistDialog"


/* ================= TYPES ================= */

type Song = {
  id: number
  title: string
  artist: string
  cover?: string
}

type Playlist = {
  id: number
  name: string
  songs: Song[]
}

/* ================= SORTABLE ROW ================= */

function SortableSongRow({
  song,
  index,
  onPlay,
  onRemove,
}: {
  song: Song
  index: number
  onPlay: () => void
  onRemove: () => void
}) {
  const { setNodeRef, attributes, listeners, transform, transition } =
    useSortable({ id: song.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group grid grid-cols-[32px_1fr_auto] gap-4 px-4 py-3 rounded-md hover:bg-secondary"
    >
      {/* DRAG + INDEX */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <GripVertical
          {...attributes}
          {...listeners}
          className="h-4 w-4 cursor-grab"
        />
        <span>{index + 1}</span>
      </div>

      {/* SONG INFO */}
      <div
        onClick={onPlay}
        className="cursor-pointer"
      >
        <p className="font-medium">{song.title}</p>
        <p className="text-sm text-muted-foreground">{song.artist}</p>
      </div>

      {/* ACTIONS */}
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 p-2 hover:text-red-500"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

/* ================= PAGE ================= */

export default function PlaylistPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [playlist, setPlaylist] = useState<Playlist | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)

  const [query, setQuery] = useState("")
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newCover, setNewCover] = useState<File | null>(null)
  const [previewCover, setPreviewCover] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { playCollection } = usePlayerStore()

  // SENSORS for Drag and Drop (Mobile Optimized)
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags on clicks
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200, // Wait 200ms before drag starts to distinguish from scroll
        tolerance: 5,
      },
    })
  )

  /* ================= FETCH ================= */

  const fetchPlaylist = async (isRefetch = false) => {
    if (!isRefetch) setLoading(true)
    try {
      const res = await playlistsApi.get(Number(id))
      setPlaylist(res.data)
      setSongs(res.data.songs || [])
    } catch (error) {
      console.error('Failed to fetch playlist:', error)
    } finally {
      if (!isRefetch) setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlaylist()
  }, [id])

  /* ================= ACTIONS ================= */
  const handlePlaySong = async (songId: number) => {
    const songIndex = songs.findIndex((song) => song.id === songId)
    if (songIndex >= 0) {
      try {
        await playCollection(songs, songIndex)
      } catch (error) {
        console.error('Failed to play song:', error)
      }
    }
  }

  const playPlaylist = async () => {
    if (songs.length === 0) return

    try {
      await playCollection(songs)
    } catch (error) {
      console.error('Failed to play playlist:', error)
    }
  }

  const removeSong = async (songId: number) => {
    try {
      await playlistsApi.removeSong(Number(id), songId)
      fetchPlaylist(true)
    } catch (error) {
      console.error('Failed to remove song:', error)
    }
  }

  /* ================= EDIT ================= */
  const handleEditClick = () => {
    if (playlist) {
      setNewName(playlist.name)
      setPreviewCover(null)
      setNewCover(null)
      setEditDialogOpen(true)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setNewCover(file)
      setPreviewCover(URL.createObjectURL(file))
    }
  }

  const savePlaylistDetails = async () => {
    if (!playlist) return
    console.log("Saving playlist...", { newName, newCover })

    try {
      // 1. Update Name
      if (newName !== playlist.name) {
        console.log("Updating name...")
        await playlistsApi.update(playlist.id, newName)
      }

      // 2. Upload Cover
      if (newCover) {
        console.log("Uploading cover...")
        await playlistsApi.uploadCover(playlist.id, newCover)
      }

      console.log("Success!")
      setEditDialogOpen(false)
      fetchPlaylist(true)
    } catch (error) {
      console.error('Failed to update playlist:', error)
    }
  }

  const deletePlaylist = async () => {
    try {
      await playlistsApi.delete(Number(id))
      navigate("/library/playlists")
    } catch (error) {
      console.error('Failed to delete playlist:', error)
    }
  }

  /* ================= FILTER ================= */

  const filteredSongs = songs.filter(
    (s) =>
      s.title.toLowerCase().includes(query.toLowerCase()) ||
      s.artist.toLowerCase().includes(query.toLowerCase())
  )

  if (loading || !playlist) return null

  return (
    <div className="px-6 py-6">
      {/* ================= STICKY HEADER ================= */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur pb-6 pt-10 md:pt-0">
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
          <div className="w-44 h-44 bg-secondary rounded-xl flex items-center justify-center overflow-hidden">
            {songs.length > 0 && songs[0]?.cover ? (
              <img
                src={
                  songs[0].cover.startsWith('http')
                    ? songs[0].cover
                    : `${API_URL}/covers/${songs[0].cover}`
                }
                alt={playlist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Music className="h-16 w-16 text-muted-foreground" />
            )}
          </div>

          <div className="flex-1">
            <p className="text-sm uppercase text-muted-foreground mt-4 md:mt-0">Playlist</p>
            <h1 className="text-3xl md:text-5xl font-bold">{playlist.name}</h1>
            <p className="text-sm text-muted-foreground mt-2">
              {songs.length} songs
            </p>

            <div className="flex items-center justify-center md:justify-start gap-4 mt-6">
              <Button
                onClick={playPlaylist}
                className="rounded-full px-8"
              >
                <Play className="mr-2 h-4 w-4" />
                Play
              </Button>

              {playlist && (
                <AddSongsToPlaylistDialog
                  playlistId={playlist.id}
                  onSongAdded={() => fetchPlaylist(true)}
                />
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 rounded-full hover:bg-secondary">
                    <MoreHorizontal />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleEditClick}>
                    Edit Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={deletePlaylist} className="text-red-500">
                    Delete playlist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* EDIT DIALOG */}
              <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Playlist</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 py-4">
                    <div className="flex gap-4">
                      <div
                        className="w-32 h-32 bg-secondary rounded-md flex items-center justify-center overflow-hidden cursor-pointer relative group"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {previewCover ? (
                          <img src={previewCover} className="w-full h-full object-cover" />
                        ) : songs.length > 0 && songs[0].cover ? (
                          <img src={songs[0].cover.startsWith('http') ? songs[0].cover : `${API_URL}${API_URL.endsWith('/') ? '' : '/'}/covers/${songs[0].cover.startsWith('/') ? songs[0].cover.slice(1) : songs[0].cover}`} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                        ) : (
                          <Music className="h-8 w-8 text-muted-foreground" />
                        )}
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs font-medium">Change</span>
                        </div>
                      </div>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                      <div className="flex-1 space-y-2">
                        <Label>Name</Label>
                        <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={savePlaylistDetails}>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* SEARCH IN PLAYLIST */}
        {songs.length > 0 && (
          <div className="mt-6 max-w-md">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search in playlist"
              className="w-full px-4 py-2 rounded-full bg-secondary focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* ================= SONG LIST ================= */}
      {songs.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          No songs in this playlist yet
          <br />
          Add songs from Search or Home
        </div>
      ) : filteredSongs.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          No matching songs
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => {
            if (!e.over) return
            const oldIndex = songs.findIndex(s => s.id === e.active.id)
            const newIndex = songs.findIndex(s => s.id === e.over.id)
            setSongs(arrayMove(songs, oldIndex, newIndex))
          }}
        >
          <SortableContext
            items={filteredSongs.map(s => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="mt-6 space-y-1">
              {filteredSongs.map((song, i) => (
                <SortableSongRow
                  key={song.id}
                  song={song}
                  index={i}
                  onPlay={() => handlePlaySong(song.id)}
                  onRemove={() => removeSong(song.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
