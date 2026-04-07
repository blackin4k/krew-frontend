import { useState } from 'react';
import { useOfflineStore } from '@/stores/offlineStore';
import SongCard from '@/components/SongCard';
import { Search, WifiOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

const OfflineLibrary = () => {
  const { downloadedSongs } = useOfflineStore();
  const [query, setQuery] = useState('');

  const filteredSongs = downloadedSongs.filter(song => 
    song.title.toLowerCase().includes(query.toLowerCase()) || 
    song.artist.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="min-h-screen p-6 bg-[#0A0A0C] pb-32">
      <div className="flex items-center gap-3 mb-8 text-white pt-8">
        <WifiOff className="h-8 w-8 text-[#3b82f6]" />
        <h1 className="text-3xl font-bold">Offline Library</h1>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder="Search downloaded songs..." 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-12 bg-[#18181A] border-white/10 text-white h-12 rounded-xl"
        />
      </div>

      {downloadedSongs.length === 0 ? (
        <div className="text-center py-20">
          <WifiOff className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
          <p className="text-xl font-bold text-white mb-2">No downloads yet.</p>
          <p className="text-muted-foreground">Go online and download some tracks to listen anywhere.</p>
        </div>
      ) : filteredSongs.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground">No matching downloads found.</p>
      ) : (
        <div className="grid gap-2">
          {filteredSongs.map((song, i) => (
            <SongCard key={song.id} song={song} index={i} variant="list" />
          ))}
        </div>
      )}
    </div>
  );
};

export default OfflineLibrary;
