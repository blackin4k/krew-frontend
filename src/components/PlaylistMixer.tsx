import { useState, useEffect } from "react"
import { playlistsApi } from "@/lib/api"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Layers, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"

export default function PlaylistMixer() {
    const [open, setOpen] = useState(false)
    const [playlists, setPlaylists] = useState<any[]>([])
    const [selected, setSelected] = useState<number[]>([])
    const [name, setName] = useState("")
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            playlistsApi.getAll().then(res => setPlaylists(res.data)).catch(console.error)
            setName("")
            setSelected([])
        }
    }, [open])

    const toggleSelect = (id: number) => {
        setSelected(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const handleMerge = async () => {
        if (selected.length < 2) return toast.error("Select at least 2 playlists")
        if (!name.trim()) return toast.error("Enter a name for the new playlist")

        try {
            setLoading(true)
            const res = await playlistsApi.merge(selected, name)
            toast.success(`Created "${name}" with ${res.data.total_songs} songs`)
            setOpen(false)
        } catch (e) {
            toast.error("Failed to merge playlists")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-white">
                    <Layers className="h-4 w-4" />
                    <span>Playlist Mixer</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-black/90 border-[#7f5fff]/20 backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle></DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">New Playlist Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Super Mix 2026"
                            className="bg-white/5 border-white/10"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground">Select Playlists to Merge</label>
                        <ScrollArea className="h-[200px] rounded-md border border-white/10 bg-white/5 p-2">
                            <div className="space-y-2">
                                {playlists.map(p => (
                                    <div key={p.id} className="flex items-center space-x-2 p-2 rounded hover:bg-white/5 transition-colors">
                                        <Checkbox
                                            id={`pl-${p.id}`}
                                            checked={selected.includes(p.id)}
                                            onCheckedChange={() => toggleSelect(p.id)}
                                            className="border-white/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                        />
                                        <label
                                            htmlFor={`pl-${p.id}`}
                                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                                        >
                                            {p.name} <span className="text-muted-foreground ml-2 text-xs">({p.song_count || 0} songs)</span>
                                        </label>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    <Button
                        onClick={handleMerge}
                        disabled={loading || selected.length < 2 || !name}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Layers className="mr-2 h-4 w-4" />}
                        Merge Playlists
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
