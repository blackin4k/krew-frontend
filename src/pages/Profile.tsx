import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Mail, Lock, Clock, Activity, TrendingUp, Music, Headphones, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { API_URL } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface UserStats {
  minutes_listened: number;
  top_genre: string;
  most_played_artist: string;
  peak_time: string;
  weekly_trend: string;
  recent_tracks: any[];
}

const Profile = () => {
    const navigate = useNavigate();
    const user = useAuthStore(state => state.user);
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [stats, setStats] = useState<UserStats | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const loadStats = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_URL}/user-stats`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);
                }
            } catch (e) {
                console.error("Failed to fetch stats", e);
            }
        };
        loadStats();
    }, []);

    const handleChangePassword = () => {
        toast({ title: 'Password changed successfully!' });
        setPwdDialogOpen(false);
    };

    return (
        <div className="min-h-screen bg-[#0A0A0C] pb-[calc(100px+env(safe-area-inset-bottom))] pt-safe px-6 font-sans">
            {/* 1. Header & Actions */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between py-6">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full bg-[#151518] text-white hover:bg-[#222]">
                    <ChevronLeft className="h-6 w-6" />
                </Button>
                <div className="flex gap-3">
                    <Button 
                        variant="ghost" 
                        onClick={() => setIsEditing(!isEditing)}
                        className="bg-[#151518] text-white rounded-full hover:bg-[#222] px-6 text-[14px]"
                    >
                        {isEditing ? 'Done' : 'Edit'}
                    </Button>
                    <Button
                        variant="destructive"
                        size="icon"
                        className="rounded-full bg-[#151518] text-[#FF4444] hover:bg-[#222]"
                        onClick={() => {
                            useAuthStore.getState().logout();
                            navigate('/auth');
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    </Button>
                </div>
            </motion.div>

            {/* 2. User Info */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center mb-8">
                <div className="h-32 w-32 rounded-full p-[3px] bg-gradient-to-br from-[#6F8CFF] to-[#A478FF] mb-4 shadow-xl shadow-[#6F8CFF]/20">
                    <div className="h-full w-full rounded-full bg-[#121212] flex items-center justify-center overflow-hidden border-4 border-[#121212]">
                        {user?.avatar ? ( 
                            <img src={user.avatar} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-4xl font-bold text-white tracking-widest">{user?.username?.charAt(0).toUpperCase() || 'U'}</span>
                        )}
                    </div>
                </div>
                {isEditing ? (
                    <Input 
                        defaultValue={user?.username || ''}
                        className="bg-[#151518] border-white/10 text-center w-48 text-[20px] font-bold h-12 rounded-2xl mb-2 focus-visible:ring-1 focus-visible:ring-[#6F8CFF]" 
                    />
                ) : (
                    <h2 className="text-[28px] font-bold text-white tracking-tight leading-none mb-2">{user?.username || 'User'}</h2>
                )}
                <div className="px-3 py-1 mt-1 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] text-[12px] font-bold uppercase tracking-wider border border-[#3b82f6]/20">
                    {(user as any)?.is_supporter ? 'Premium' : 'Free'}
                </div>
            </motion.div>

            {/* 3. Stats Dashboard */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <h3 className="text-[18px] font-bold text-white mb-4">Your Dashboard</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-[#151518] rounded-[24px] p-5 flex flex-col justify-between h-[110px] border border-white/5 shadow-md">
                        <div className="p-2 rounded-full bg-[#6F8CFF]/10 w-fit">
                            <Clock className="w-5 h-5 text-[#6F8CFF]" />
                        </div>
                        <div>
                            <div className="text-[22px] font-bold text-white leading-none">{stats?.minutes_listened?.toLocaleString() || '...'}</div>
                            <div className="text-[12px] text-[#9CA3AF] mt-1 font-medium">Minutes Listened</div>
                        </div>
                    </div>
                    <div className="bg-[#151518] rounded-[24px] p-5 flex flex-col justify-between h-[110px] border border-white/5 shadow-md">
                        <div className="p-2 rounded-full bg-[#A478FF]/10 w-fit">
                            <Headphones className="w-5 h-5 text-[#A478FF]" />
                        </div>
                        <div>
                            <div className="text-[18px] font-bold text-white leading-none truncate">{stats?.most_played_artist || '...'}</div>
                            <div className="text-[12px] text-[#9CA3AF] mt-1 font-medium">Top Artist</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="bg-[#151518] rounded-[24px] p-5 flex flex-col justify-between h-[110px] border border-white/5 shadow-md">
                        <div className="p-2 rounded-full bg-orange-500/10 w-fit">
                            <Activity className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                            <div className="text-[16px] font-bold text-white leading-none truncate">{stats?.peak_time || '...'}</div>
                            <div className="text-[12px] text-[#9CA3AF] mt-1 font-medium">Peak Listening</div>
                        </div>
                    </div>
                    <div className="bg-[#151518] rounded-[24px] p-5 flex flex-col justify-between h-[110px] border border-white/5 shadow-md">
                        <div className="p-2 rounded-full bg-emerald-500/10 w-fit">
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                            <div className="text-[18px] font-bold text-white leading-none truncate">{stats?.weekly_trend || '...'}</div>
                            <div className="text-[12px] text-[#9CA3AF] mt-1 font-medium">Weekly Trend</div>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* 4. Sound Capsule */}
            <motion.button
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                onClick={() => navigate('/capsule')}
                className="mb-8 flex w-full items-center justify-between gap-4 rounded-[28px] border border-[#6F8CFF]/20 bg-gradient-to-r from-[#151518] via-[#1A1A24] to-[#111827] p-5 text-left shadow-[0_18px_50px_rgba(79,70,229,0.12)] transition-all hover:border-[#6F8CFF]/35 hover:shadow-[0_20px_60px_rgba(79,70,229,0.18)] active:scale-[0.99]"
            >
                <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[#6F8CFF]/15 text-[#9FB2FF]">
                        <Sparkles className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[18px] font-bold text-white">Sound Capsule</p>
                        <p className="text-sm text-[#B6BDD2]">
                            {stats?.top_genre
                                ? `Open your monthly recap and revisit your ${stats.top_genre} phase.`
                                : 'Open your full monthly listening recap.'}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                    Open
                    <ChevronRight className="h-4 w-4" />
                </div>
            </motion.button>

            {/* 5. Activity/Recently Played */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
                <h3 className="text-[18px] font-bold text-white mb-4">Recently Played</h3>
                <div className="space-y-3">
                    {stats?.recent_tracks?.length ? stats.recent_tracks.map((track, i) => (
                        <div key={i} className="flex items-center gap-4 bg-[#151518] p-3 rounded-[20px] border border-white/5 shadow-sm active:scale-[0.98] transition-transform">
                            <img src={track.cover || 'https://kreewaux.xyz/logo.png'} className="w-12 h-12 rounded-xl object-cover" />
                            <div className="flex-1 min-w-0">
                                <h4 className="text-white text-sm font-bold truncate">{track.title}</h4>
                                <p className="text-[#9CA3AF] text-xs truncate">{track.artist}</p>
                            </div>
                            <Music className="w-4 h-4 text-[#9CA3AF] opacity-50" />
                        </div>
                    )) : (
                        <div className="text-center text-[#9CA3AF] py-6 bg-[#151518] rounded-[20px] border border-white/5">
                            No recent activity
                        </div>
                    )}
                </div>
            </motion.div>

            {/* 6. Settings Form */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-6">
                <h3 className="text-[18px] font-bold text-white">Account Info</h3>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[13px] font-medium text-[#9CA3AF] uppercase tracking-wider ml-1">Email</label>
                        <div className="flex items-center gap-3 h-14 px-5 rounded-[20px] bg-[#151518] border border-white/5">
                            <Mail className="h-5 w-5 text-[#9CA3AF]" />
                            {isEditing ? (
                                <Input defaultValue={user?.email || ''} className="bg-transparent border-none text-white h-full px-0 focus-visible:ring-0" />
                            ) : (
                                <span className="text-white font-medium">{user?.email || 'No email linked'}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="pt-4">
                    <Button onClick={() => setPwdDialogOpen(true)} variant="outline" className="w-full h-14 rounded-[20px] bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white justify-between px-6">
                        Change Password
                        <Lock className="w-5 h-5 opacity-50" />
                    </Button>
                </div>
            </motion.div>

            {/* Password Dialog */}
            <Dialog open={pwdDialogOpen} onOpenChange={setPwdDialogOpen}>
                <DialogContent className="bg-[#1A1A1D] border-white/10 text-white rounded-2xl sm:rounded-2xl max-w-sm rounded-t-3xl border-t border-t-white/10 pb-10 sm:pb-6 mt-auto sm:mt-0 flex flex-col gap-0 top-auto bottom-0 sm:top-[50%] sm:bottom-auto translate-y-[0] sm:translate-y-[-50%] absolute sm:relative">
                    <DialogHeader className="pt-4 sm:pt-0">
                        <DialogTitle className="text-2xl font-bold">Change Password</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-6">
                        <Input type="password" placeholder="Current Password" value={passwords.current} onChange={e => setPasswords({...passwords, current: e.target.value})} className="bg-[#151518] border-none rounded-2xl h-12 text-sm focus-visible:ring-1 focus-visible:ring-[#6F8CFF]" />
                        <Input type="password" placeholder="New Password" value={passwords.new} onChange={e => setPasswords({...passwords, new: e.target.value})} className="bg-[#151518] border-none rounded-2xl h-12 text-sm focus-visible:ring-1 focus-visible:ring-[#6F8CFF]" />
                        <Input type="password" placeholder="Confirm Password" value={passwords.confirm} onChange={e => setPasswords({...passwords, confirm: e.target.value})} className="bg-[#151518] border-none rounded-2xl h-12 text-sm focus-visible:ring-1 focus-visible:ring-[#6F8CFF]" />
                        <Button onClick={handleChangePassword} className="w-full rounded-2xl h-12 bg-[#6F8CFF] text-white hover:bg-[#5a75e6]">Update Password</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Profile;
