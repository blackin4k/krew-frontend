import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Search as SearchIcon, X } from 'lucide-react';
import { browseApi } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';

const Artists = () => {
  const [artists, setArtists] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    browseApi
      .artists()
      .then((res) => setArtists(res.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const filteredArtists = useMemo(() => {
    return artists.filter(artist =>
      artist.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [artists, searchQuery]);

  // Generate a consistent color for each artist based on their name
  const getArtistColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 60%, 40%)`;
  };

  return (
    <div className="min-h-screen pb-32 p-6 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-display font-bold">Artists</h1>
          <p className="text-muted-foreground">{artists.length} artists</p>
        </div>

        <div className="relative w-full md:w-80">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search artists..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-10 bg-secondary/50 border-0 rounded-full focus-visible:ring-primary/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse text-center">
              <div className="aspect-square rounded-full bg-muted mx-auto" />
              <div className="mt-3 h-4 bg-muted rounded w-3/4 mx-auto" />
            </div>
          ))}
        </div>
      ) : filteredArtists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {filteredArtists.map((artist, i) => (
            <motion.button
              key={artist}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.01 }}
              onClick={() => navigate(`/artist/${encodeURIComponent(artist)}`)}
              className="group text-center"
            >
              <div
                className="aspect-square rounded-full mx-auto overflow-hidden transition-transform duration-300 group-hover:scale-105 group-hover:shadow-xl flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${getArtistColor(artist)}, ${getArtistColor(artist + 'dark')})` }}
              >

                <span className="text-3xl font-display font-bold text-white/90">
                  {artist.charAt(0).toUpperCase()}
                </span>
              </div>

              <h3 className="mt-3 font-semibold truncate group-hover:text-primary transition-colors">
                {artist}
              </h3>
              <p className="text-sm text-muted-foreground">Artist</p>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          {searchQuery ? (
            <>
              <SearchIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-20" />
              <h2 className="text-xl font-display font-bold mb-2">No matches for "{searchQuery}"</h2>
              <p className="text-muted-foreground">Try a different search term</p>
            </>
          ) : (
            <>
              <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-display font-bold mb-2">No artists found</h2>
              <p className="text-muted-foreground">Artists will appear here as you add music</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Artists;
