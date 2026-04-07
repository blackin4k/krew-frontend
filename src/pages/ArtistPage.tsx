import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, Shuffle, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SongCard from '@/components/SongCard';
import { browseApi, radioApi } from '@/lib/api';
import { Artist as ArtistType, Song } from '@/types/music';
import { usePlayerStore } from '@/stores/playerStore';

import { API_URL } from '@/lib/api';

const ArtistPage = () => {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [artist, setArtist] = useState<ArtistType | null>(null);
  const [loading, setLoading] = useState(true);
  const { playSong } = usePlayerStore();

  useEffect(() => {
    if (name) {
      browseApi
        .artist(name)
        .then((res) => setArtist(res.data))
        .catch(() => { })
        .finally(() => setLoading(false));
    }
  }, [name]);

  const handlePlayRadio = async () => {
    if (!name) return;
    try {
      const res = await radioApi.artist(name);
      if (res.data && res.data.length > 0) {
        playSong(res.data[0]);
      }
    } catch (error) {
      console.error('Failed to start radio:', error);
    }
  };

  // Generate color based on artist name
  const getArtistColor = (artistName: string) => {
    let hash = 0;
    for (let i = 0; i < artistName.length; i++) {
      hash = artistName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 60%, 40%)`;
  };

  if (loading) {
    return (
      <div className="min-h-screen pb-32 p-6 md:p-8">
        <div className="animate-pulse">
          <div className="h-72 bg-muted rounded-xl mb-6" />
          <div className="h-8 bg-muted rounded w-1/4 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Artist not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="relative h-80 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${getArtistColor(artist.artist)}, ${getArtistColor(artist.artist + 'secondary')})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />

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
            className="flex items-end gap-6"
          >
            <div
              className="w-40 h-40 rounded-full shadow-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${getArtistColor(artist.artist)}, ${getArtistColor(artist.artist + 'dark')})` }}
            >

              <span className="text-6xl font-display font-bold text-white/90">
                {artist.artist.charAt(0).toUpperCase()}
              </span>
            </div>


            <div className="flex-1">
              <p className="text-sm font-medium mb-1">ARTIST</p>
              <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">{artist.artist}</h1>
              <p className="text-muted-foreground mb-4">
                {artist.albums.length} albums · {artist.top_tracks.length} popular tracks
              </p>

              <div className="flex gap-3">
                <Button onClick={handlePlayRadio} className="glow-primary-sm">
                  <Radio className="mr-2 h-4 w-4" />
                  Artist Radio
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-10">
        {/* Popular Tracks */}
        {artist.top_tracks.length > 0 && (
          <section>
            <h2 className="text-xl font-display font-bold mb-4">Popular</h2>
            <div className="space-y-1">
              {artist.top_tracks.map((track, i) => (
                <SongCard
                  key={track.id}
                  song={track}
                  index={i}
                  variant="list"
                  showIndex
                />
              ))}
            </div>
          </section>
        )}

        {/* Albums */}
        {artist.albums.length > 0 && (
          <section>
            <h2 className="text-xl font-display font-bold mb-4">Discography</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {artist.albums.map((album, i) => (
                <motion.button
                  key={album.album}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/album/${encodeURIComponent(album.album)}`)}
                  className="group text-left rounded-xl overflow-hidden bg-card hover:bg-secondary transition-all hover-lift"
                >
                  <div className="aspect-square relative overflow-hidden">
                    {album.cover ? (
                      <img
                        src={album.cover.startsWith('http') ? album.cover : `${API_URL}${API_URL.endsWith('/') ? '' : '/'}/covers/${album.cover.startsWith('/') ? album.cover.slice(1) : album.cover}`}
                        alt={album.album}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <span className="text-4xl text-muted-foreground">♪</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold truncate">{album.album}</h3>
                    <p className="text-sm text-muted-foreground">Album</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ArtistPage;
