import { useEffect, useState } from 'react';
import { libraryApi } from '@/lib/api';
import { Song } from '@/types/music';
import SongCard from '@/components/SongCard';
import { Heart, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlayerStore } from '@/stores/playerStore';
import { motion } from 'framer-motion';

const LikedSongs = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const { playCollection } = usePlayerStore();

  useEffect(() => {
    libraryApi
      .getLiked()
      .then((res) => setSongs(res.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const handlePlay = async () => {
    if (songs.length > 0) {
      await playCollection(songs);
    }
  };

  return (
    <div>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-6"
      >
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary to-purple-500 shadow-lg">
          <Heart className="h-8 w-8 text-white fill-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-display font-bold">Liked Songs</h2>
          <p className="text-muted-foreground">{songs.length} songs</p>
        </div>
        {songs.length > 0 && (
          <Button onClick={handlePlay} className="glow-primary-sm">
            <Play className="h-4 w-4 mr-2 fill-current" />
            Play All
          </Button>
        )}
      </motion.div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-4 p-2">
              <div className="w-6 h-4 bg-muted rounded" />
              <div className="w-12 h-12 rounded bg-muted" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                <div className="h-3 bg-muted rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : songs.length > 0 ? (
        <div className="flex flex-col gap-1">
          {songs.map((song, i) => (
            <SongCard key={song.id} song={song} index={i} variant="list" showIndex />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Heart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No liked songs yet</p>
          <p className="text-sm text-muted-foreground">Like songs to add them here</p>
        </div>
      )}
    </div>
  );
};

export default LikedSongs;
