import { useEffect, useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, Check } from "lucide-react"
import { songsApi, playlistsApi } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"

interface Song {
    id: number
    title: string
    artist: string
    cover?: string
}

interface Props {
    playlistId: number
    onSongAdded?: () => void
}

export default function AddSongsToPlaylistDialog({ playlistId, onSongAdded }: Props) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [songs, setSongs] = useState<Song[]>([])
    const [loading, setLoading] = useState(false)
    const [addedIds, setAddedIds] = useState<number[]>([])
    const { toast } = useToast()

    // Search songs when query changes
    useEffect(() => {
        if (!open) return

        const search = async () => {
            setLoading(true)
            try {
                if (!query.trim()) {
                    // Fetch default songs
                    const res = await songsApi.getAll(1, 20)
                    // /songs returns { items: [...] }
                    setSongs(res.data.items || res.data.songs || [])
                } else {
                    const res = await songsApi.search(query)
                    if (res.data && Array.isArray(res.data)) {
                        setSongs(res.data);
                    } else if (res.data && Array.isArray(res.data.results)) {
                        setSongs(res.data.results);
                    } else {
                        setSongs([]);
                    }
                }
            } catch (error) {
                console.error("Failed to search", error)
            } finally {
                setLoading(false)
            }
        }

        const timeout = setTimeout(search, 300)
        return () => clearTimeout(timeout)
    }, [query, open])

    const addSong = async (songId: number) => {
        try {
            await playlistsApi.addSong(playlistId, songId)
            setAddedIds((prev) => [...prev, songId])
            toast({ title: "Song added" })
            onSongAdded?.()
        } catch (error) {
            toast({ title: "Failed to add song", variant: "destructive" })
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="secondary" className="rounded-full">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Songs
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md h-[500px] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Add Songs to Playlist</DialogTitle>
                </DialogHeader>

                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search songs..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 mt-2">
                    {loading ? (
                        <p className="text-center text-muted-foreground py-4">Loading...</p>
                    ) : songs.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">No songs found</p>
                    ) : (
                        songs.map(song => (
                            <div key={song.id} className="flex items-center justify-between p-2 hover:bg-secondary rounded-md group">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    {song.cover ? (
                                        <>
                                            <img
                                                src={song.cover}
                                                className="w-10 h-10 rounded object-cover"
                                                onError={(e) => {
                                                    e.currentTarget.src = ""
                                                    e.currentTarget.style.display = "none"
                                                    e.currentTarget.nextElementSibling?.classList.remove("hidden")
                                                }}
                                            />
                                            <div className="hidden w-10 h-10 bg-muted rounded flex items-center justify-center">
                                                <Music className="h-5 w-5 text-muted-foreground" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                                            <Music className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="font-medium truncate">{song.title}</p>
                                        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                                    </div>
                                </div>

                                <Button
                                    size="sm"
                                    variant={addedIds.includes(song.id) ? "ghost" : "default"}
                                    onClick={() => addSong(song.id)}
                                    disabled={addedIds.includes(song.id)}
                                >
                                    {addedIds.includes(song.id) ? <Check className="h-4 w-4" /> : "Add"}
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

function Music({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
        </svg>
    )
}
