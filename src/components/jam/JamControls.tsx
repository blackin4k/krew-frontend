import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useJamStore } from '@/stores/jamStore';
import { Radio, Users, Copy, LogOut, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface JamControlsProps {
    className?: string;
}

export function JamControls({ className }: JamControlsProps) {
    const {
        jamId, setJamId,
        connectedJam,
        createJam,
        joinJam,
        leaveJam,
        listeners,
        isHost
    } = useJamStore();

    const copyToClipboard = () => {
        if (!jamId) return;
        navigator.clipboard.writeText(jamId);
        toast.success('Jam ID copied!');
    };

    return (
        <div className={cn("space-y-6", className)}>

            {/* HEADER STATUS */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-3 h-3 rounded-full animate-pulse",
                        connectedJam ? "bg-blue-500 shadow-[0_0_10px_#3b82f6]" : "bg-white/20"
                    )} />
                    <div>
                        <h2 className="text-lg font-bold">Session Status</h2>
                        <p className="text-xs text-muted-foreground">{connectedJam ? 'Connected' : 'Offline'}</p>
                    </div>
                </div>

                {connectedJam && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                        <Users className="w-3.5 h-3.5 text-white/70" />
                        <span className="text-xs font-mono">{listeners.length}</span>
                    </div>
                )}
            </div>

            {/* CONNECTION FORM */}
            {!connectedJam ? (
                <div className="space-y-4 bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-md">
                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold ml-1">Jam ID</label>
                        <Input
                            value={jamId}
                            onChange={(e) => setJamId(e.target.value)}
                            placeholder="e.g. KV-1234"
                            className="bg-black/20 border-white/10 text-center font-mono text-lg tracking-widest h-12"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button
                            onClick={() => createJam()}
                            className="bg-primary hover:bg-primary/90 h-12 font-bold"
                        >
                            <Play className="w-4 h-4 mr-2 fill-current" /> Create
                        </Button>
                        <Button
                            onClick={() => joinJam()}
                            variant="outline"
                            className="border-white/10 hover:bg-white/5 h-12"
                        >
                            Join
                        </Button>
                    </div>
                </div>
            ) : (
                /* ACTIVE SESSION INFO */
                <div className="space-y-4">
                    <div className="p-4 bg-gradient-to-br from-primary/20 to-purple-500/10 rounded-xl border border-primary/20 relative overflow-hidden">
                        {/* Glow effect */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-3xl -mr-16 -mt-16" />

                        <div className="relative z-10 text-center space-y-3">
                            <span className="text-xs text-primary/80 uppercase font-bold tracking-widest">Active Session</span>
                            <div
                                onClick={copyToClipboard}
                                className="text-3xl font-black font-mono text-white tracking-widest cursor-pointer hover:scale-105 transition-transform active:scale-95"
                            >
                                {jamId}
                            </div>
                            <p className="text-xs text-white/40">Tap ID to copy connection code</p>
                        </div>
                    </div>

                    {isHost && (
                        <div className="px-4 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-500 text-xs text-center font-medium">
                            You are the Host. Control the music!
                        </div>
                    )}

                    <Button
                        onClick={leaveJam}
                        variant="ghost"
                        className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 h-12"
                    >
                        <LogOut className="w-4 h-4 mr-2" /> Disconnect
                    </Button>

                    {/* LISTENER GRID */}
                    <div className="pt-4 border-t border-white/10">
                        <div className="flex items-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-white/50" />
                            <span className="text-sm font-medium text-white/70">In the Room</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {listeners.map((user, i) => (
                                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5">
                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                                        {user.charAt(0).toUpperCase()}
                                    </div>
                                    <span className="text-xs truncate text-white/80">{user}</span>
                                </div>
                            ))}
                            {listeners.length === 0 && <span className="text-xs text-white/30 italic px-2">Waiting for crew...</span>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
