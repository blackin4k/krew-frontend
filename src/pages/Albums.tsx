import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Disc3, Search as SearchIcon, X } from 'lucide-react';
import { browseApi, API_URL } from '@/lib/api';
import { Album } from '@/types/music';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';

// Removed local API_URL definition

const Albums = () => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    browseApi
      .albums()
      .then((res) => setAlbums(res.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const filteredAlbums = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return albums.filter(album =>
      album.album.toLowerCase().includes(query) ||
      album.artist.toLowerCase().includes(query)
    );
  }, [albums, searchQuery]);

  return (
    <div className="min-h-screen pb-32 p-6 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-display font-bold">Albums</h1>
          <p className="text-muted-foreground">{albums.length} albums in your library</p>
        </div>

        <div className="relative w-full md:w-80">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search albums or artists..."
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square rounded-xl bg-muted" />
              <div className="mt-3 h-4 bg-muted rounded w-3/4" />
              <div className="mt-2 h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredAlbums.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredAlbums.map((album, i) => (
            <motion.button
              key={`${album.album}-${album.artist}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => navigate(`/album/${encodeURIComponent(album.album)}`)}
              className="group text-left rounded-xl overflow-hidden bg-card hover:bg-secondary transition-all hover-lift cursor-pointer"
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
                    <Disc3 className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold truncate">{album.album}</h3>
                <p className="text-sm text-muted-foreground truncate">{album.artist}</p>
                <p className="text-xs text-muted-foreground mt-1">{album.tracks} tracks</p>
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          {searchQuery ? (
            <>
              <SearchIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-20" />
              <h2 className="text-xl font-display font-bold mb-2">No albums matching "{searchQuery}"</h2>
              <p className="text-muted-foreground">Try searching for something else</p>
            </>
          ) : (
            <>
              <Disc3 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-display font-bold mb-2">No albums found</h2>
              <p className="text-muted-foreground">Albums will appear here as you add music</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default Albums;
