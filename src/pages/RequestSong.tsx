import { useState } from 'react';
import { API_URL } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Music2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const RequestSong = () => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [song, setSong] = useState('');
    const [artist, setArtist] = useState('');
    const [link, setLink] = useState('');
    const [notes, setNotes] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!song.trim()) return;

        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/request-song`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ song, artist, link, notes })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            toast({
                title: "Request Sent 🎧",
                description: "We'll verify and add it shortly!",
            });

            setSong('');
            setArtist('');
            setLink('');
            setNotes('');
        } catch (err: any) {
            toast({
                title: err.message || "Failed to send",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white pb-32 pt-safe px-6">
            <div className="flex flex-col gap-6 mt-8">

                {/* HEADER */}
                <div className="space-y-2">
                    <h1 className="text-2xl font-bold">Request a Song</h1>
                    <p className="text-[#9CA3AF] text-sm">Can’t find something? Send it to us.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">

                    <div className="space-y-2">
                        <label className="text-[13px] text-[#9CA3AF] font-medium">Song Name</label>
                        <Input
                            placeholder="Enter song title"
                            className="bg-[#151518] border-none rounded-2xl h-12 px-4 text-sm focus-visible:ring-1 focus-visible:ring-[#6F8CFF]"
                            required
                            value={song}
                            onChange={(e) => setSong(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[13px] text-[#9CA3AF] font-medium">Artist (Optional)</label>
                        <Input
                            placeholder="Artist name"
                            className="bg-[#151518] border-none rounded-2xl h-12 px-4 text-sm focus-visible:ring-1 focus-visible:ring-[#6F8CFF]"
                            value={artist}
                            onChange={(e) => setArtist(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[13px] text-[#9CA3AF] font-medium">Playlist Link (Spotify / Apple / YouTube)</label>
                        <Input
                            placeholder="Paste playlist link"
                            className="bg-[#151518] border-none rounded-2xl h-12 px-4 text-sm focus-visible:ring-1 focus-visible:ring-[#6F8CFF]"
                            value={link}
                            onChange={(e) => setLink(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[13px] text-[#9CA3AF] font-medium">Notes</label>
                        <Textarea
                            placeholder="Anything we should know?"
                            className="bg-[#151518] border-none rounded-2xl min-h-[90px] px-4 py-3 text-sm focus-visible:ring-1 focus-visible:ring-[#6F8CFF] resize-none"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={loading || !song.trim()}
                        className="w-full h-14 rounded-[22px] bg-[#6F8CFF] hover:bg-[#5a75e6] text-white font-semibold text-[15px] mt-2 transition-transform active:scale-[0.98]"
                    >
                        {loading ? 'Sending 🎧...' : 'Submit Request'}
                    </Button>

                </form>
            </div>
        </div>
    );
};

export default RequestSong;
