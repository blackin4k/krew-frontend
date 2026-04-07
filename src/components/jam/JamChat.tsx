import { useRef, useEffect, useState } from 'react';
import { useJamStore } from '@/stores/jamStore';
import { usePlayerStore } from '@/stores/playerStore';
import { Send, SkipForward, Settings, MessageSquare, Disc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface JamChatProps {
    className?: string;
}

export function JamChat({ className }: JamChatProps) {
    const { messages, sendMessage, voteSkip, listeners } = useJamStore();
    const { next } = usePlayerStore();
    const [messageText, setMessageText] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = () => {
        if (!messageText.trim()) return;
        sendMessage(messageText);
        setMessageText('');
    };

    return (
        <div className={cn("flex flex-col h-full overflow-hidden relative", className)}>

            {/* Chat Messages Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            >
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground/40 space-y-2">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                            <MessageSquare className="w-8 h-8" />
                        </div>
                        <p className="text-sm">Start the conversation...</p>
                    </div>
                )}

                <AnimatePresence initial={false}>
                    {messages.map((m, i) => {
                        // Check if message is from the current user (this requires the backend/store to identify 'me')
                        // For now, we'll style all messages consistently but maybe alternate slightly or check a local ID if available.
                        // Assuming 'm.user' is the username.
                        const isSystem = m.user === 'System';

                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                className={cn(
                                    "flex flex-col max-w-[85%]",
                                    isSystem ? "self-center items-center w-full" : "self-start" // Default to left alignment for now
                                )}
                            >
                                {!isSystem && <span className="text-[10px] text-white/50 mb-1 ml-2">{m.user}</span>}

                                <div className={cn(
                                    "px-4 py-2 text-sm shadow-lg backdrop-blur-md",
                                    isSystem
                                        ? "bg-white/5 text-xs text-white/60 rounded-full px-3 py-1"
                                        : "bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl rounded-tl-sm text-white"
                                )}>
                                    {m.message}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>

            {/* Input Area - Floating Glass Bar */}
            <div className="p-4 pt-2">
                <div className="relative flex items-center gap-2 bg-black/40 backdrop-blur-xl border border-white/10 p-1.5 rounded-full shadow-2xl">
                    <Input
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type a message..."
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        className="flex-1 bg-transparent border-none h-10 px-4 focus-visible:ring-0 text-white placeholder:text-white/30"
                    />

                    <Button
                        onClick={handleSendMessage}
                        size="icon"
                        className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground w-10 h-10 shrink-0"
                        disabled={!messageText.trim()}
                    >
                        <Send className="w-4 h-4" />
                    </Button>

                    <div className="w-px h-6 bg-white/10 mx-1" />

                    <Button
                        onClick={voteSkip}
                        variant="ghost"
                        size="icon"
                        className="rounded-full hover:bg-white/10 text-white/70 hover:text-white w-10 h-10 shrink-0"
                        title="Vote Skip"
                    >
                        <SkipForward className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
