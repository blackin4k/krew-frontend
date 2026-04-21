import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Shuffle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SongCard from '@/components/SongCard';
import { browseApi, API_URL } from '@/lib/api';
import { Song } from '@/types/music';
import { usePlayerStore } from '@/stores/playerStore';

// Removed local API_URL definition

const AlbumPage = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const { playCollection } = usePlayerStore();

  useEffect(() => {
    if (name) {
      setLoading(true);
      browseApi
        .albumSongs(name)
        .then((res) => setSongs(res.data || []))
        .catch(() => { })
        .finally(() => setLoading(false));
    }
  }, [name]);

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

  // Get artist from first song
  const artist = songs[0]?.artist || 'Unknown Artist';

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="relative h-80 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-muted to-background" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

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
            className="flex flex-col md:flex-row items-center md:items-end gap-6 md:gap-8 text-center md:text-left"
          >
            <div className="w-48 h-48 md:w-64 md:h-64 rounded-xl shadow-2xl overflow-hidden bg-muted flex items-center justify-center flex-shrink-0 mx-auto md:mx-0">
              {songs[0]?.cover ? (
                <img
                  src={songs[0].cover.startsWith('http') ? songs[0].cover : `${API_URL}${API_URL.endsWith('/') ? '' : '/'}/covers/${songs[0].cover.startsWith('/') ? songs[0].cover.slice(1) : songs[0].cover}`}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-6xl text-muted-foreground">♪</span>
              )}
            </div>

            <div className="flex-1 w-full flex flex-col items-center md:items-start">
              <p className="text-xs uppercase tracking-widest text-white/70 mb-2">Album</p>
              <h1 className="text-3xl md:text-5xl font-display font-bold text-white mb-2 leading-tight">{name}</h1>
              <button
                onClick={() => navigate(`/artist/${encodeURIComponent(artist)}`)}
                className="text-lg text-white/80 hover:text-white hover:underline transition-colors mb-4 block font-medium"
              >
                {artist}
              </button>
              <p className="text-sm text-white/50 mb-6 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {songs.length} songs • {new Date().getFullYear()} {/* Mock year for layout */}
              </p>

              <div className="flex gap-4 w-full md:w-auto justify-center md:justify-start">
                <Button onClick={handlePlay} className="h-12 px-8 rounded-full bg-primary text-black font-bold hover:scale-105 transition-transform" size="lg">
                  <Play className="mr-2 h-5 w-5 fill-current" />
                  Play
                </Button>
                <Button onClick={handleShuffle} variant="secondary" className="h-12 px-6 rounded-full bg-white/10 hover:bg-white/20 text-white" size="lg">
                  <Shuffle className="mr-2 h-5 w-5" />
                  Shuffle
                </Button>
              </div>
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
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {songs.map((song, i) => (
              <SongCard
                key={song.id}
                song={song}
                index={i}
                variant="list"
                showIndex
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlbumPage;
