import { useState, useEffect } from "react"
import { libraryApi } from "@/lib/api"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, CopyX, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

export default function DuplicateFinder() {
    const [open, setOpen] = useState(false)
    const [duplicates, setDuplicates] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    const fetchDuplicates = async () => {
        try {
            setLoading(true)
            const res = await libraryApi.getDuplicates()
            setDuplicates(res.data)
        } catch (e) {
            toast.error("Failed to scan for duplicates")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open) {
            fetchDuplicates()
        }
    }, [open])

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-white">
                    <CopyX className="h-4 w-4" />
                    <span>Duplicate Assassin</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-black/90 border-[#7f5fff]/20 backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CopyX className="h-5 w-5 text-red-500" />
                        Duplicate Assassin
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin mb-2" />
                            <p>Scanning library...</p>
                        </div>
                    ) : duplicates.length === 0 ? (
                        <div className="text-center py-8 text-blue-400">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-sm text-blue-400/70">No duplicate songs found.</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 p-3 rounded bg-red-500/10 text-red-200 text-sm">
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                <span>Found {duplicates.length} sets of duplicates.</span>
                            </div>

                            <ScrollArea className="h-[300px] rounded-md border border-white/10 bg-white/5 p-2">
                                <div className="space-y-2">
                                    {duplicates.map((d, i) => (
                                        <div key={i} className="flex flex-col p-2 rounded bg-white/5">
                                            <div className="font-medium truncate">{d.title}</div>
                                            <div className="text-xs text-muted-foreground">{d.artist}</div>
                                            <div className="text-xs text-red-400 mt-1">{d.count} copies found</div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>

                            <p className="text-xs text-center text-muted-foreground">
                                Automated deletion coming soon. Please manually check these songs.
                            </p>
                        </>
                    )}

                    <Button
                        onClick={() => setOpen(false)}
                        className="w-full"
                        variant="outline"
                    >
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
