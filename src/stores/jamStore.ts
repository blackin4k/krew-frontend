import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { jamSocketHandlers, API_URL, configureJamPlayback } from "@/lib/api";
import { usePlayerStore } from "@/stores/playerStore";
import { v4 as uuidv4 } from 'uuid';

interface VoteState {
    votes: number;
    required: number;
}

interface Message {
    user: string;
    message: string;
}

interface JamStore {
    jamId: string;
    connectedJam: string | null;
    isHost: boolean;
    listeners: string[];
    messages: Message[];
    votes: VoteState | null;
    socket: Socket | null;

    setJamId: (id: string) => void;
    createJam: () => Promise<void>;
    joinJam: (id?: string) => Promise<void>;
    leaveJam: () => void;
    sendMessage: (text: string) => void;
    voteSkip: () => void;

    // Handlers for socket events (internal use mostly, but exposed if needed)
    setListeners: (listeners: string[]) => void;
    addMessage: (msg: Message) => void;
    setIsHost: (isHost: boolean) => void;
    setVotes: (votes: VoteState) => void;
}

export const useJamStore = create<JamStore>((set, get) => ({
    jamId: '',
    connectedJam: null,
    isHost: false,
    listeners: [],
    messages: [],
    votes: null,
    socket: null,

    setJamId: (id) => set({ jamId: id }),

    setListeners: (listeners) => set({ listeners }),
    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
    setIsHost: (isHost) => set({ isHost }),
    setVotes: (votes) => set({ votes }),

    createJam: async () => {
        const id = uuidv4().slice(0, 8);
        set({ jamId: id });
        await get().joinJam(id);
    },

    joinJam: async (id) => {
        const { jamId, socket: existingSocket } = get();
        const room = id || jamId;
        const token = localStorage.getItem('token');

        if (!room) {
            toast.error('Enter a Jam ID or create one');
            return;
        }

        // 🔓 AUDIO UNLOCK: Trigger silent play/pause to unlock Mobile Safari/Chrome AudioContext
        const store = usePlayerStore.getState();
        const audio = store.audio;
        if (audio) {
            audio.play().then(() => {
                audio.pause();
                console.log("Audio Context Unlocked 🔓");
            }).catch(e => console.error("Audio Unlock Failed", e));
        }
        if (store._audioCtx && store._audioCtx.state === 'suspended') {
            store._audioCtx.resume();
        }

        if (existingSocket) {
            existingSocket.disconnect();
            set({ socket: null });
        }

        try {
            const socket = io(API_URL, {
                transports: ['polling', 'websocket'], // Retry polling if websocket fails
                autoConnect: false,
            });

            // Bind handlers
            socket.on("jam:play", jamSocketHandlers.onPlay);
            socket.on("jam:sync", jamSocketHandlers.onSync);
            socket.on("jam:seek", jamSocketHandlers.onSeek);
            socket.on("jam:pause", jamSocketHandlers.onPause);
            socket.on("jam:heartbeat", jamSocketHandlers.onHeartbeat);

            socket.on('connect', () => {
                // Suppress initial broadcast briefly until we receive sync from server
                usePlayerStore.setState({ isRemoteUpdate: true });
                setTimeout(() => usePlayerStore.setState({ isRemoteUpdate: false }), 500);

                socket.emit('jam:join', { jam_id: room, token });
                set({ connectedJam: room });
                toast.success(`Joined jam ${room}`);
            });

            socket.on('connect_error', (err) => {
                console.error("Socket Error:", err);
                toast.error(`Socket Connection Failed: ${err.message}`);
            });

            socket.on('jam:listeners', (data: any) => {
                set({ listeners: Array.isArray(data) ? data : [] });
            });

            socket.on('jam:message', (data: any) => {
                set((state) => ({
                    messages: [...state.messages, { user: data.user || 'anon', message: data.message || '' }]
                }));
            });

            socket.on('jam:host', (data: any) => {
                if (data?.user_id) {
                    const meId = token ? (() => {
                        try {
                            const d = JSON.parse(atob(token.split('.')[1]));
                            return parseInt(d.sub);
                        } catch { return null; }
                    })() : null;
                    set({ isHost: meId === data.user_id });
                }
            });

            socket.on('jam:skip_votes', (data: any) => {
                set({ votes: { votes: data.votes || 0, required: data.required || 0 } });
            });

            socket.connect();
            set({ socket });

        } catch (error) {
            console.error('Join jam error', error);
            toast.error('Failed to join jam');
        }
    },

    leaveJam: () => {
        const { socket } = get();
        if (socket) {
            socket.disconnect();
        }
        set({
            socket: null,
            connectedJam: null,
            listeners: [],
            messages: [],
            isHost: false,
            votes: null
        });
        toast('Left jam');
    },

    sendMessage: (text) => {
        const { socket, connectedJam } = get();
        const token = localStorage.getItem('token');

        if (!text.trim() || !socket || !connectedJam) return;

        socket.emit('jam:message', { jam_id: connectedJam, token, message: text });
    },

    voteSkip: () => {
        const { socket, connectedJam } = get();
        const token = localStorage.getItem('token');

        if (!socket || !connectedJam) return;

        socket.emit('jam:vote_skip', { jam_id: connectedJam, token });
        toast('Voted to skip');
    }
}));
