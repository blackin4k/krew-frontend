import React, { useEffect, useState } from 'react';
import { usePlayerStore } from '@/stores/playerStore';
import { playerApi } from '@/lib/api';
import { normalizeQueueResponse } from '@/lib/queue';
import { motion, Reorder } from "framer-motion";
import { GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface QueueItem {
    id: number;
    title: string;
    artist: string;
    cover?: string;
}

interface QueueDisplayProps {
    className?: string;
    color?: string;
    onClose?: () => void;
}

const QueueDisplay: React.FC<QueueDisplayProps> = ({ className, color = '#ffffff', onClose }) => {
    const { currentSong, isPlaying, playSong } = usePlayerStore();
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchQueue = async () => {
        try {
            setLoading(true);
            const res = await playerApi.queue();
            const normalized = normalizeQueueResponse<QueueItem>(res.data);
            console.log("QUEUE FROM BACKEND:", normalized.queue);
            setQueue(normalized.queue);
        } catch (e) {
            console.error("Failed to fetch queue", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
    }, [currentSong?.id]); // Refetch when song changes

    const handleReorder = async (newQueue: QueueItem[]) => {
        setQueue(newQueue);
        try {
            await playerApi.modifyQueue('reorder', { song_ids: newQueue.map(s => s.id) });
        } catch (e) {
            console.error("Failed to save new queue order", e);
        }
    };

    // Filter to show "Playing Next" - typically songs after the current one
    // But for now, let's show the whole queue and highlight current
    // Or if the user wants "Playing Next", maybe we slice?
    // Let's matching Apple Music: "Playing Next" usually implies the queue.

    // Find index of current song
    const currentIndex = queue.findIndex(s => s.id === currentSong?.id);
    const nextSongs = currentIndex !== -1 ? queue.slice(currentIndex + 1) : queue;
    // If we are at the end or not found, show all (fallback) or empty?
    // Let's show the whole queue for now, but mark current.
    // Actually, "Playing Next" usually excludes history. 

    // Let's just render the list received from backend for now.
    // If the backend returns the *active* queue (shuffled or original), we use that.

    // Grouping:
    // 1. Current Song (Often shown at top of player, not list)
    // 2. "Playing Next" (The rest)

    return (
        <div className={cn("flex flex-col h-full w-full", className)}>
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-2 shrink-0">
                <h3 className="text-xl font-bold text-white">Playing Next</h3>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                    >
                        <X className="h-5 w-5 text-white" />
                    </button>
                )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-2 no-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full" />
                    </div>
                ) : queue.length === 0 ? (
                    <div className="text-white/40 text-center py-10">Queue is empty</div>
                ) : (
                    <Reorder.Group axis="y" values={queue} onReorder={handleReorder} className="space-y-1">
                        {queue.map((song, i) => {
                            const isCurrent = song.id === currentSong?.id;

                            // Color accent logic
                            const activeStyle = isCurrent ? { color: color } : {};

                            return (
                                <Reorder.Item
                                    value={song}
                                    id={song.id.toString()}
                                    key={`${song.id}-${i}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className={cn(
                                        "flex items-center gap-3 p-2 rounded-xl transition-colors group",
                                        isCurrent ? "bg-white/10" : "hover:bg-white/5"
                                    )}
                                    // onClick handles playback, but dragging shouldn't trigger click. 
                                    // framer-motion Reorder handles this usually.
                                    onClick={() => {
                                        if (!isCurrent) {
                                            playSong(song as any);
                                        }
                                    }}
                                >
                                    {/* Cover */}
                                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 shrink-0 relative">
                                        {song.cover ? (
                                            <img src={song.cover} alt={song.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-xs text-white/20">♪</div>
                                        )}
                                        {isCurrent && isPlaying && (
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                <div className="w-1 h-3 bg-white animate-bounce mx-0.5" style={{ animationDelay: '0s' }} />
                                                <div className="w-1 h-4 bg-white animate-bounce mx-0.5" style={{ animationDelay: '0.1s' }} />
                                                <div className="w-1 h-2 bg-white animate-bounce mx-0.5" style={{ animationDelay: '0.2s' }} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Text */}
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <div
                                            className={cn("font-medium truncate text-[15px]", isCurrent ? "text-white" : "text-white/90")}
                                            style={activeStyle}
                                        >
                                            {song.title}
                                        </div>
                                        <div className="text-[13px] text-white/50 truncate">
                                            {song.artist}
                                        </div>
                                    </div>

                                    {/* Drag Handle (Visual only for now) */}
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-white/40">
                                        <GripVertical className="w-5 h-5" />
                                    </div>
                                </Reorder.Item>
                            );
                        })}
                    </Reorder.Group>
                )}
            </div>
        </div>
    );
};

export default QueueDisplay;
