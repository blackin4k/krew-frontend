import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Radio as RadioIcon, Music, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import SongCard from '@/components/SongCard';
import { radioApi, browseApi } from '@/lib/api';
import { Song } from '@/types/music';
import { toast } from 'sonner';
import { usePlayerStore } from '@/stores/playerStore';

interface RadioStation {
  type: 'song' | 'artist' | 'album';
  name: string;
  id?: number;
  image?: string;
}

const Radio = () => {
  const [activeStation, setActiveStation] = useState<RadioStation | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingRadio, setPlayingRadio] = useState(false);
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const { playCollection } = usePlayerStore();

  useEffect(() => {
    // Load recently played for quick access (placeholder for future enhancements)
    const loadRecent = async () => {
      try {
        await browseApi.genres();
      } catch (error) {
        console.error('Failed to load recent:', error);
      }
    };
    loadRecent();
  }, []);

  const loadRadioStation = async (station: RadioStation) => {
    if (loading) return; // Prevent double/triple loads
    try {
      setLoading(true);
      setActiveStation(station);
      setSongs([]);

      let response;
      if (station.type === 'song' && station.id) {
        response = await radioApi.song(station.id);
      } else if (station.type === 'artist') {
        response = await radioApi.artist(station.name);
      } else if (station.type === 'album') {
        response = await radioApi.album(station.name);
      }

      setSongs(response?.data || []);
      toast.success(`Started ${station.name} radio`);
    } catch (error) {
      console.error('Failed to load radio station:', error);
      toast.error('Failed to load radio station');
    } finally {
      setLoading(false);
    }
  };

  const handleBecauseYouListened = async (songId: number, songTitle: string) => {
    try {
      setLoading(true);
      setActiveStation({ type: 'song', name: `Because you listened to ${songTitle}`, id: songId });
      const res = await radioApi.becauseYouListened(songId);
      setSongs(res.data || []);
      toast.success(`Generating recommendations...`);
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      toast.error('Failed to generate recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayRadio = async () => {
    if (songs.length === 0 || loading || playingRadio) return;
    try {
      setPlayingRadio(true);
      await playCollection(songs);
      toast.success('Radio started');
    } catch (e) {
      console.error('Failed to start radio playback', e);
      toast.error('Failed to start radio playback');
    } finally {
      setPlayingRadio(false);
    }
  };

  const sampleStations: RadioStation[] = [
    { type: 'artist', name: 'Radiohead' },
    { type: 'artist', name: 'The Beatles' },
    { type: 'artist', name: 'Pink Floyd' },
  ];

  return (
    <div className="p-6 space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <RadioIcon className="w-8 h-8 text-primary" />
          <h1 className="text-4xl font-bold">Radio</h1>
        </div>
        <p className="text-muted-foreground">Discover new music based on your favorites</p>
      </div>

      {/* Featured Radio Stations */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Featured Radio Stations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sampleStations.map((station) => (
            <motion.button
              key={`${station.type}-${station.name}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => loadRadioStation(station)}
              disabled={loading}
              className={`p-6 rounded-lg border-2 transition-all text-left ${
                activeStation?.name === station.name
                  ? 'bg-primary/20 border-primary'
                  : 'bg-card border-border hover:border-primary/50'
              } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <RadioIcon className="w-8 h-8 text-primary mb-3" />
              <p className="font-semibold">{station.name}</p>
              <p className="text-sm text-muted-foreground">{station.type} radio</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Active Radio Station */}
      {activeStation && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">{activeStation.name}</h2>
              <p className="text-muted-foreground mt-1">
                {loading ? 'Loading...' : `${songs.length} songs`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handlePlayRadio}
                disabled={loading || playingRadio || songs.length === 0}
                className="min-w-[120px]"
              >
                {playingRadio ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Starting...
                  </span>
                ) : (
                  'Play Radio'
                )}
              </Button>
              <Button
                onClick={() => {
                  setActiveStation(null);
                  setSongs([]);
                }}
                variant="outline"
              >
                Clear
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : songs.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {songs.slice(0, 30).map((song, idx) => {
                // Defensive: skip if missing required fields
                if (!song || !song.title || !song.artist) return null;
                return (
                  <motion.div
                    key={song.id || idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <SongCard
                      song={song}
                      onBecauseYouListened={(songId, title) =>
                        handleBecauseYouListened(songId, title)
                      }
                    />
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Music className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No songs found for this station</p>
            </div>
          )}
        </div>
      )}

      {/* Info Card */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 rounded-lg p-6">
        <h3 className="font-semibold mb-2">💡 About Radio</h3>
        <p className="text-sm text-muted-foreground">
          Radio stations automatically generate playlists based on your favorite songs, artists, or albums. Use "Because you listened" to discover recommendations based on any track.
        </p>
      </div>
    </div>
  );
};

export default Radio;
