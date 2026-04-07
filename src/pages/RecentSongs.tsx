import { useEffect, useState } from 'react';
import { libraryApi } from '@/lib/api';
import { Song } from '@/types/music';
import SongCard from '@/components/SongCard';
import { Clock } from 'lucide-react';
import { motion } from 'framer-motion';

const RecentSongs = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    libraryApi
      .getRecent()
      .then((res) => setSongs(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-6"
      >
        <div className="p-4 rounded-xl bg-secondary shadow-lg">
          <Clock className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold">Recently Played</h2>
          <p className="text-muted-foreground">{songs.length} songs</p>
        </div>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {songs.map((song, i) => (
            <SongCard key={`${song.id}-${i}`} song={song} index={i} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No recently played songs</p>
          <p className="text-sm text-muted-foreground">Start listening to see your history</p>
        </div>
      )}
    </div>
  );
};

export default RecentSongs;
