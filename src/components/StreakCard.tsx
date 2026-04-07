import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Flame, Clock, Music } from 'lucide-react';
import { libraryApi } from '@/lib/api';

interface StreakStats {
    streak_days: number;
    minutes_today: number;
    top_genre: string;
}

const StreakCard = () => {
    const [stats, setStats] = useState<StreakStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await libraryApi.getStreak();
                setStats(res.data);
            } catch (e) {
                console.error("Failed to fetch streak", e);
                // Graceful fallback: show zeros
                setStats({ streak_days: 0, minutes_today: 0, top_genre: "Unknown" });
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    if (loading) {
        // Shimmer skeleton that matches the card dimensions
        return (
            <div className="w-full rounded-[28px] p-6 relative overflow-hidden border border-[#6F8CFF]/30 bg-gradient-to-br from-[#6F8CFF]/20 to-[#6F8CFF]/5 animate-pulse">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-5 h-5 rounded-full bg-white/20" />
                    <div className="h-4 w-44 rounded-lg bg-white/20" />
                </div>
                <div className="flex flex-col gap-2 ml-0.5">
                    <div className="h-3.5 w-36 rounded-lg bg-white/15" />
                    <div className="h-3.5 w-48 rounded-lg bg-white/15" />
                </div>
            </div>
        );
    }

    const displayGenre =
        stats?.top_genre && stats.top_genre.toLowerCase() !== 'unknown'
            ? stats.top_genre
            : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="w-full rounded-[28px] p-6 relative overflow-hidden border border-[#6F8CFF]/50 shadow-[0_20px_50px_rgba(111,140,255,0.15)] bg-gradient-to-br from-[#6F8CFF]/40 to-[#6F8CFF]/10"
        >
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <Flame className="w-5 h-5 text-orange-400 fill-orange-400 animate-pulse" />
                    <h2 className="text-[18px] font-bold text-white tracking-tight">
                        {stats?.streak_days} Day Listening Streak
                    </h2>
                </div>

                <div className="flex flex-col gap-1.5 ml-0.5">
                    <div className="flex items-center gap-2 text-[14px] text-[#E0E7FF]/80">
                        <Clock className="w-3.5 h-3.5" />
                        <span><span className="text-white font-medium">{stats?.minutes_today} minutes</span> today</span>
                    </div>

                    <div className="flex items-center gap-2 text-[14px] text-[#E0E7FF]/80">
                        <Music className="w-3.5 h-3.5" />
                        {displayGenre ? (
                            <span>
                                <span className="text-white font-medium">
                                    {displayGenre}
                                </span>{' '}
                                dominating your week
                            </span>
                        ) : (
                            <span className="text-[#E0E7FF]/70">
                                Your vibe is still evolving
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default StreakCard;

