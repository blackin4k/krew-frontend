import { useEffect, useState } from 'react';
import { Music2, Clock, Mic2, Disc3, Sparkles } from 'lucide-react';
import { capsuleApi } from '@/lib/api';
import { toast } from 'sonner';

interface CapsuleStats {
    total_minutes: number;
    total_seconds?: number;
    top_songs: Array<{ id: number; title: string; artist: string; cover: string | null; plays: number }>;
    top_artists: Array<{ name: string; plays: number }>;
    top_genres: Array<{ genre: string; plays: number }>;
}

const CapsulePage = () => {
    const [stats, setStats] = useState<CapsuleStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        capsuleApi.getStats()
            .then((res) => setStats(res.data))
            .catch((err) => {
                console.error(err);
                toast.error('Failed to load sound capsule');
            })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="h-full w-full overflow-y-auto no-scrollbar relative pb-32">
            {/* Background Gradient */}
            <div className="fixed inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 pointer-events-none -z-10" />

            <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-8">
                {/* Header */}
                <div className="flex flex-col gap-2 pt-4">
                    <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-white via-indigo-200 to-white/60 bg-clip-text text-transparent flex items-center gap-2 md:gap-4">
                        <Sparkles className="h-8 w-8 md:h-10 md:w-10 text-yellow-400 fill-yellow-400/20" />
                        Your Sound Capsule
                    </h1>
                    <p className="text-base md:text-xl text-white/50 font-light">Your listening journey this month</p>
                </div>

                {loading ? (
                    <div className="flex h-[50vh] items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                    </div>
                ) : stats ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">

                        {/* 1. Minutes Card (Full Width) */}
                        <div className="col-span-1 md:col-span-2 lg:col-span-2 p-6 md:p-8 rounded-3xl bg-gradient-to-r from-blue-600/20 to-indigo-600/20 border border-white/10 flex items-center justify-between group hover:scale-[1.01] transition-transform">
                            <div>
                                <p className="text-base md:text-lg font-medium text-blue-200 mb-2 flex items-center gap-2">
                                    <Clock className="h-4 w-4 md:h-5 md:w-5" /> Total Time
                                </p>
                                <p className="text-5xl md:text-7xl font-black text-white tracking-tighter flex items-baseline gap-2">
                                    {stats.total_minutes > 0 ? (
                                        <>
                                            {stats.total_minutes} <span className="text-lg md:text-2xl font-normal text-white/50 tracking-normal">min</span>
                                        </>
                                    ) : (
                                        <>
                                            {stats.total_seconds || 0} <span className="text-lg md:text-2xl font-normal text-white/50 tracking-normal">sec</span>
                                        </>
                                    )}
                                </p>
                            </div>
                            <div className="h-20 w-20 md:h-32 md:w-32 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse-slow">
                                <Music2 className="h-10 w-10 md:h-16 md:w-16 text-blue-400" />
                            </div>
                        </div>

                        {/* 4. Top Genres (Pills) -> Moved up for balance */}
                        <div className="col-span-1 p-6 md:p-8 rounded-3xl bg-white/5 border border-white/5 flex flex-col justify-center gap-4 md:gap-6">
                            <h3 className="text-lg md:text-xl font-bold text-white/80">Vibes</h3>
                            <div className="flex flex-wrap gap-2 md:gap-3">
                                {stats.top_genres.map((g) => (
                                    <span key={g.genre} className="px-3 py-1 md:px-4 md:py-2 rounded-full bg-white/10 text-white text-xs md:text-sm font-medium border border-white/5 hover:bg-white/20 transition-colors cursor-default">
                                        {g.genre}
                                    </span>
                                ))}
                                {stats.top_genres.length === 0 && (
                                    <p className="text-white/40 italic">No genres yet.</p>
                                )}
                            </div>
                        </div>

                        {/* 2. Top Songs */}
                        <div className="col-span-1 lg:col-span-2 p-6 md:p-8 rounded-3xl bg-white/5 border border-white/5 space-y-4 md:space-y-6">
                            <h3 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
                                <Disc3 className="h-5 w-5 md:h-6 md:w-6 text-purple-400" /> Top Songs
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                {stats.top_songs.map((song, i) => (
                                    <div key={song.id} className="flex items-center gap-3 md:gap-4 group p-2 md:p-3 rounded-2xl hover:bg-white/5 transition-colors bg-black/20 border border-white/5">
                                        <span className="text-lg md:text-2xl font-black text-white/10 w-6 md:w-8 text-center">{i + 1}</span>
                                        <img
                                            src={song.cover || '/default-cover.png'}
                                            alt={song.title}
                                            className="w-12 h-12 md:w-14 md:h-14 rounded-lg object-cover shadow-lg"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white truncate text-base md:text-lg">{song.title}</p>
                                            <p className="text-white/60 truncate text-sm">{song.artist}</p>
                                        </div>
                                        <span className="text-[10px] md:text-xs font-mono bg-white/10 px-2 py-1 rounded-md text-white/60 whitespace-nowrap">{song.plays} plays</span>
                                    </div>
                                ))}
                                {stats.top_songs.length === 0 && (
                                    <p className="text-white/40 italic col-span-2">No songs played yet.</p>
                                )}
                            </div>
                        </div>

                        {/* 3. Top Artists */}
                        <div className="col-span-1 p-6 md:p-8 rounded-3xl bg-white/5 border border-white/5 space-y-4 md:space-y-6">
                            <h3 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
                                <Mic2 className="h-5 w-5 md:h-6 md:w-6 text-pink-400" /> Top Artists
                            </h3>
                            <div className="space-y-3 md:space-y-4">
                                {stats.top_artists.map((artist, i) => (
                                    <div key={artist.name} className="flex items-center gap-3 md:gap-4 p-2 md:p-3 rounded-2xl hover:bg-white/5 transition-colors">
                                        <span className="text-lg md:text-xl font-bold text-white/20 w-6 text-center">{i + 1}</span>
                                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-gradient-to-tr from-pink-500 to-orange-500 flex items-center justify-center text-white font-bold text-base md:text-lg shadow-lg">
                                            {artist.name[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white text-base md:text-lg truncate">{artist.name}</p>
                                        </div>
                                        <span className="text-[10px] md:text-xs font-mono text-white/40">{artist.plays}</span>
                                    </div>
                                ))}
                                {stats.top_artists.length === 0 && (
                                    <p className="text-white/40 italic">No artists played yet.</p>
                                )}
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="text-center text-white/50 pt-20">
                        Failed to load stats.
                    </div>
                )}
            </div>
        </div>
    );
};

export default CapsulePage;
