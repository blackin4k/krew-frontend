import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Trash2, Music, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { playerApi } from '@/lib/api';
import { usePlayerStore } from '@/stores/playerStore';
import { normalizeQueueResponse } from '@/lib/queue';
import { toast } from 'sonner';

interface QueueSong {
  id: number;
  title: string;
  artist: string;
}

const Queue = () => {
  const [queue, setQueue] = useState<QueueSong[]>([]);
  const [currentSongId, setCurrentSongId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const { playSong, currentSong } = usePlayerStore();

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const res = await playerApi.queue();
      const normalized = normalizeQueueResponse<QueueSong>(res.data);
      setQueue(normalized.queue);
      setCurrentSongId(normalized.currentSongId ?? currentSong?.id ?? null);
    } catch (error) {
      console.error('Failed to fetch queue:', error);
      toast.error('Failed to load queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 2000);
    return () => clearInterval(interval);
  }, [currentSong?.id]);

  const handleRemoveSong = async (songId: number) => {
    try {
      await playerApi.modifyQueue('remove', { song_ids: [songId] });
      setQueue(queue.filter((s) => s.id !== songId));
      toast.success('Song removed from queue');
    } catch (error) {
      console.error('Failed to remove song:', error);
      toast.error('Failed to remove song');
    }
  };

  const handleClearQueue = async () => {
    try {
      await playerApi.modifyQueue('clear', {});
      setQueue([]);
      toast.success('Queue cleared');
    } catch (error) {
      console.error('Failed to clear queue:', error);
      toast.error('Failed to clear queue');
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedItem(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedItem === null || draggedItem === index) {
      setDraggedItem(null);
      return;
    }

    const newQueue = [...queue];
    const [draggedSong] = newQueue.splice(draggedItem, 1);
    newQueue.splice(index, 0, draggedSong);

    setQueue(newQueue);
    setDraggedItem(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Music className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
          <p className="text-muted-foreground">Loading queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Queue</h1>
          <p className="text-muted-foreground mt-2">{queue.length} songs</p>
        </div>
        {queue.length > 0 && (
          <Button
            variant="outline"
            onClick={handleClearQueue}
            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950 border-red-200"
          >
            Clear Queue
          </Button>
        )}
      </div>

      {queue.length === 0 ? (
        <Card className="flex items-center justify-center p-12 border-2 border-dashed">
          <div className="text-center">
            <Music className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No songs in queue</p>
            <p className="text-sm text-muted-foreground mt-2">
              Play a song to add it to the queue
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {queue.map((song, index) => (
            <motion.div
              key={`${song.id}-${index}`}
              layout
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              className={`flex items-center justify-between p-4 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                song.id === currentSongId
                  ? 'bg-primary/10 border-primary shadow-md'
                  : 'bg-card hover:bg-accent border-border'
              } ${draggedItem === index ? 'opacity-50' : ''}`}
            >
              <div className="flex items-center gap-4 flex-1">
                <span className="text-sm font-semibold text-muted-foreground w-8">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className={`font-medium ${song.id === currentSongId ? 'text-primary' : ''}`}>
                    {song.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{song.artist}</p>
                </div>
                {song.id === currentSongId && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                    Now Playing
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => playSong(song as any)}
                  className="text-primary hover:bg-primary/10"
                >
                  <Play className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveSong(song.id)}
                  className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3 mt-6">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Drag and drop songs to reorder them in your queue
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Queue;
