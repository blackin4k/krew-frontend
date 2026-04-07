import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search as SearchIcon, X, Filter, Play } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SongCard from '@/components/SongCard';
import { songsApi, browseApi, API_URL } from '@/lib/api';
import { Song, Genre } from '@/types/music';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/stores/playerStore';

const Search = () => {
  const [query, setQuery] = useState('');
  const [searchData, setSearchData] = useState({
    topMatch: null as Song | null,
    results: [] as Song[],
    recommended: [] as Song[]
  });
  const cache = useRef<Record<string, any>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const [trending, setTrending] = useState<Song[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const navigate = useNavigate();
  const { playSong } = usePlayerStore(); // Added playSong hook

  useEffect(() => {
    // Load initial data
    const loadInit = async () => {
      try {
        const [genresRes, trendingRes] = await Promise.all([
          browseApi.genres(),
          songsApi.getTrending() // Ensure api.ts has this
        ]);
        setGenres(genresRes.data || []);
        setTrending(trendingRes.data || []);
      } catch (e) { console.error(e); }
    };

    // Load recent searches
    const saved = localStorage.getItem('recentSearches');
    if (saved) setRecentSearches(JSON.parse(saved));

    loadInit();
  }, []);

  useEffect(() => {
    const searchSongs = async () => {
      if (!query.trim() && !selectedGenre) {
        setSearchData({ topMatch: null, results: [], recommended: [] });
        setHasSearched(false);
        return;
      }

      setHasSearched(true);
      
      let finalQuery = query.trim();
      const lowerQuery = finalQuery.toLowerCase();
      const moodMap: Record<string, string> = {
        'sad': 'melancholy',
        'sad songs': 'melancholy',
        'gym': 'workout',
        'gym songs': 'workout',
        'workout': 'workout',
        'late night drive': 'chill',
        'chill': 'chill',
        'study': 'lo-fi',
      };
      if (moodMap[lowerQuery]) {
        finalQuery = moodMap[lowerQuery];
      }

      const cacheKey = `${finalQuery}-${selectedGenre || ''}`;

      if (cache.current[cacheKey]) {
        setSearchData(cache.current[cacheKey]);
        setLoading(false);
        return;
      }

      setLoading(true);

      // Save to recent searches if typing stopped (debounce limit)
      if (query.trim().length > 2 && !recentSearches.includes(query.trim())) {
        const updated = [query.trim(), ...recentSearches].slice(0, 5);
        setRecentSearches(updated);
        localStorage.setItem('recentSearches', JSON.stringify(updated));
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const res = await songsApi.search(finalQuery, selectedGenre || undefined, undefined, {
          signal: abortControllerRef.current.signal
        });

        let newData: { topMatch: Song | null, results: Song[], recommended: Song[] } = {
          topMatch: null,
          results: [],
          recommended: []
        };

        if (!res.data || (Array.isArray(res.data) && res.data.length === 0) || (res.data.results && res.data.results.length === 0 && !res.data.top_match)) {
          // Keep empty struct
        } else if (res.data.top_match !== undefined) {
          newData = {
            topMatch: res.data.top_match,
            results: res.data.results || [],
            recommended: []
          };
        } else if (Array.isArray(res.data)) {
          // Fallback
          newData = {
            topMatch: null,
            results: res.data,
            recommended: []
          };
        } else {
          newData = {
            topMatch: null,
            results: res.data.results || [],
            recommended: res.data.recommended || []
          };
        }

        cache.current[cacheKey] = newData;
        setSearchData(newData);

      } catch (error: any) {
        if (error.name === 'CanceledError' || error.message === 'canceled') {
          return; // Ignore aborted requests
        }
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchSongs, 300);
    return () => clearTimeout(debounce);
  }, [query, selectedGenre]);

  const clearSearch = () => {
    setQuery('');
    setSelectedGenre(null);
    setSearchData({ topMatch: null, results: [], recommended: [] });
    setHasSearched(false);
  };

  const removeRecent = (term: string) => {
    const updated = recentSearches.filter(t => t !== term);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  }

  return (
    <div className="min-h-screen pb-40 md:pb-32 p-4 md:p-6 bg-[#0A0A0C]">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 pt-[calc(env(safe-area-inset-top)+1rem)] sticky top-0 z-20 bg-[#0A0A0C]/80 backdrop-blur-xl pb-4 -mx-4 px-4 border-b border-white/5"
      >
        <h1 className="text-[32px] font-bold text-white mb-4 tracking-tight">Search</h1>

        {/* Search input - Large Pill */}
        <div className="relative max-w-full group">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#9CA3AF] pointer-events-none z-10 transition-colors group-focus-within:text-white" />
          <Input
            type="text"
            placeholder="Artists, Songs, Lyrics..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 pr-12 h-12 text-[16px] text-white bg-[#151518] border-white/5 rounded-[12px] shadow-sm focus-visible:ring-1 focus-visible:ring-[#6F8CFF] placeholder:text-[#555] font-medium transition-all w-full"
          />
          {(query || selectedGenre) && (
            <button
              onClick={clearSearch}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full bg-[#121212]/10 hover:bg-[#121212]/20 text-[#121212] transition-colors z-10"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          )}
        </div>

        {/* Genre filters - Chips (Horizontal Scroll) */}
        {!hasSearched && (
          <div className="flex overflow-x-auto gap-2 mt-4 pb-2 -mx-4 px-4 scrollbar-hide">
            {genres.slice(0, 8).map((genre) => (
              <button
                key={genre.genre}
                onClick={() => {
                  setSelectedGenre(selectedGenre === genre.genre ? null : genre.genre);
                  if (query) setQuery('');
                }}
                className={cn(
                  'px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all border whitespace-nowrap',
                  selectedGenre === genre.genre
                    ? 'bg-white text-black border-white'
                    : 'bg-[#1A1A1A] text-[#E0E0E0] border-transparent hover:bg-[#2A2A2A]'
                )}
              >
                {genre.genre}
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Results or Browse */}
      {hasSearched ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {loading ? (
            <div className="text-center py-10 text-muted-foreground text-sm">Searching...</div>
          ) : searchData.results.length > 0 || searchData.topMatch ? (
            <>
              {/* TOP RESULT */}
              {searchData.topMatch && (
                <div className="mb-6">
                  <h3 className="text-[14px] font-bold text-[#A1A1AA] uppercase tracking-wider mb-3">Top Result</h3>
                  <div
                    onClick={() => playSong(searchData.topMatch!)}
                    className="relative bg-[#18181B] p-4 rounded-[20px] flex items-center gap-4 cursor-pointer hover:bg-[#202022] transition-colors border border-white/5 group hover:scale-[1.02] duration-300 ease-out overflow-hidden"
                  >
                    {/* Gradient Glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-[#6F8CFF]/10 to-[#3b82f6]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                    <div className="w-[80px] h-[80px] rounded-full overflow-hidden shrink-0 shadow-lg relative">
                      {searchData.topMatch.cover ? (
                        <img 
                          src={searchData.topMatch.cover} 
                          className="w-full h-full object-cover" 
                          onError={(e) => { e.currentTarget.src = 'https://placehold.co/80x80/282828/FFF?text=Music'; }}
                        />
                      ) : (
                        <div className="w-full h-full bg-[#333]" />
                      )}

                      {/* Play Overlay */}
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <div className="h-10 w-10 bg-[#3b82f6] rounded-full flex items-center justify-center text-black shadow-lg">
                           <Play className="h-5 w-5 fill-black ml-1" />
                         </div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[20px] font-bold text-white mb-1 line-clamp-1 group-hover:text-[#3b82f6] transition-colors">{searchData.topMatch.title}</div>
                      <div className="text-[15px] text-[#A1A1AA] flex items-center gap-2">
                        <span className="text-white bg-[#27272A] px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide">Song</span>
                        <span>{searchData.topMatch.artist}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-[18px] font-bold text-white mb-2 tracking-tight">
                  Songs
                </p>
              </div>

              <div className="flex flex-col gap-1">
                {searchData.results.map((song, i) => (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <SongCard song={song} index={i} variant="list" />
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-20 px-4">
              <p className="text-[18px] font-bold text-white mb-2">No results found</p>
              <p className="text-[15px] text-[#B3B3B3]">
                Please check the spelling or try different keywords.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">

          {/* RECENT SEARCHES */}
          {recentSearches.length > 0 && (
            <section className="mb-2">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-[16px] font-bold text-white">Recent Searches</h3>
                <button onClick={() => {
                  setRecentSearches([]);
                  localStorage.removeItem('recentSearches');
                }} className="text-[12px] text-[#A1A1AA] hover:text-white transition-colors">Clear</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map(term => (
                  <div key={term} className="group flex items-center gap-2 bg-[#18181B] pl-4 pr-2 py-2 rounded-full border border-white/5 hover:bg-[#202022] transition-colors">
                    <span onClick={() => setQuery(term)} className="text-[13px] font-medium text-[#E4E4E7] cursor-pointer group-hover:text-white transition-colors">{term}</span>
                    <X onClick={() => removeRecent(term)} className="w-3.5 h-3.5 text-[#52525B] cursor-pointer hover:text-[#EF4444] transition-colors" />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* BECAUSE YOU SEARCHED */}
          {recentSearches.length > 0 && trending.length > 0 && (
            <motion.section 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="mt-6"
            >
              <h3 className="text-[16px] font-bold text-white mb-4">Because you searched "{recentSearches[0]}"</h3>
              <div className="flex overflow-x-auto gap-3 pb-4 scrollbar-hide -mx-4 px-4 pl-4">
                {trending.slice(0, 5).map((song) => (
                  <div key={`because-${song.id}`} className="min-w-[140px] shrink-0">
                    <SongCard song={song} variant="grid" />
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* CONTINUE LISTENING (Intelligent Dummy) */}
          <motion.section 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className={recentSearches.length > 0 ? "mt-4" : ""}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 bg-[#3b82f6]/10 rounded-full">
                <Play className="w-3.5 h-3.5 fill-[#3b82f6] text-[#3b82f6]" />
              </div>
              <h3 className="text-[16px] font-bold text-white">Continue Listening</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {trending.slice(recentSearches.length > 0 ? 5 : 0, recentSearches.length > 0 ? 9 : 4).map((song) => (
                <div key={song.id} onClick={() => playSong(song)} className="flex items-center gap-3 bg-[#18181B] p-2 rounded-[12px] cursor-pointer hover:bg-[#202022] transition-colors group border border-white/5">
                  <div className="w-[48px] h-[48px] rounded-[8px] overflow-hidden relative shrink-0">
                    {song.cover && <img src={song.cover} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = 'https://placehold.co/48x48/282828/FFF?text=Music'; }} />}
                    <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center transition-all">
                      <Play className="w-4 h-4 fill-white text-white" />
                    </div>
                  </div>
                  <div className="min-w-0 pr-2">
                    <div className="text-[13px] font-semibold text-white truncate group-hover:text-[#3b82f6] transition-colors">{song.title}</div>
                    <div className="text-[11px] text-[#A1A1AA] truncate">{song.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* BROWSE ALL */}
          <section className="pt-4">
            <h2 className="text-[20px] font-bold text-white mb-4 tracking-tight">Browse All</h2>
            <div className="grid grid-cols-2 gap-3">
              {genres.map((genre, i) => (
                <motion.button
                  key={genre.genre}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(`/genre/${genre.genre}`)}
                  className="relative h-24 overflow-hidden rounded-[12px] hover:brightness-110 transition-all shadow-lg"
                  style={{ backgroundColor: ['#E13300', '#7358FF', '#1E3264', '#E8115B', '#116040', '#D84000', '#E91429', '#8C1932'][i % 8] }}
                >
                  <span className="absolute top-3 left-3 font-bold text-[16px] text-white tracking-tight leading-none">{genre.genre}</span>
                  {genre.cover && (
                    <img
                      src={genre.cover.startsWith('http') ? genre.cover : `${API_URL}/covers/${genre.cover}`}
                      alt={genre.genre}
                      className="absolute right-[-10%] bottom-[-5%] w-16 h-16 rotate-[25deg] shadow-lg"
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
export default Search;
