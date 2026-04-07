import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SongCard from '@/components/SongCard';
import { browseApi, API_URL } from '@/lib/api';
import { Song } from '@/types/music';
import { usePlayerStore } from '@/stores/playerStore';

// Removed local API_URL definition

const GenrePage = () => {
  const { genre } = useParams<{ genre: string }>();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const { playCollection } = usePlayerStore();

  useEffect(() => {
    if (genre) {
      browseApi
        .genreSongs(genre)
        .then((res) => setSongs(res.data || []))
        .catch(() => { })
        .finally(() => setLoading(false));
    }
  }, [genre]);

  const handlePlay = async () => {
    if (songs.length > 0) {
      await playCollection(songs);
    }
  };

  const handleShuffle = async () => {
    if (songs.length > 0) {
      const shuffledSongs = [...songs].sort(() => Math.random() - 0.5);
      await playCollection(shuffledSongs);
    }
  };

  const coverUrl = songs[0]?.cover
    ? (songs[0].cover.startsWith('http') ? songs[0].cover : `${API_URL}${API_URL.endsWith('/') ? '' : '/'}/covers/${songs[0].cover.startsWith('/') ? songs[0].cover.slice(1) : songs[0].cover}`)
    : null;

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="relative h-72 overflow-hidden">
        {coverUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center blur-2xl scale-110 opacity-50"
            style={{ backgroundImage: `url(${coverUrl})` }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/40" />

        <div className="relative h-full flex flex-col justify-end p-6 md:p-8">
          <button
            onClick={() => navigate(-1)}
            className="absolute top-6 left-6 p-2 rounded-full bg-background/50 hover:bg-background/80 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm text-primary font-medium mb-2">GENRE</p>
            <h1 className="text-4xl md:text-5xl font-display font-bold mb-2">{genre}</h1>
            <p className="text-muted-foreground mb-6">{songs.length} songs</p>

            <div className="flex gap-3">
              <Button onClick={handlePlay} className="glow-primary-sm" size="lg">
                <Play className="mr-2 h-5 w-5 fill-current" />
                Play
              </Button>
              <Button onClick={handleShuffle} variant="outline" size="lg">
                <Shuffle className="mr-2 h-5 w-5" />
                Shuffle
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Songs */}
      <div className="p-6 md:p-8">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
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
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {songs.map((song, i) => (
              <SongCard key={song.id} song={song} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GenrePage;
