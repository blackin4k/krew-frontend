import { useEffect, useRef } from 'react';
import { useJamStore } from "@/stores/jamStore";
import { usePlayerStore } from "@/stores/playerStore";
import { toast } from "sonner";

export function JamManager() {
    const { isHost, connectedJam, socket } = useJamStore();
    const { isPlaying, currentSong, audio } = usePlayerStore();
    const isSeeking = useRef(false);
    const lastBroadcastState = useRef<{ isPlaying: boolean; songId: number | undefined }>({
        isPlaying: false,
        songId: undefined
    });

    // IMPERATIVE SYNC: Listen for direct play commands from PlayerStore
    useEffect(() => {
        if (!connectedJam || !socket) return;

        const handleImperativePlay = (e: CustomEvent) => {
            const { songId, position } = e.detail;
            console.log("JamManager: IMPERATIVE PLAY RECEIVED", songId);

            socket.emit('jam:play', {
                jam_id: connectedJam,
                token: localStorage.getItem('token'),
                song_id: songId,
                position: position || 0
            });
            console.log("JamManager: Imperative play sent");
        };

        window.addEventListener('krew:play' as any, handleImperativePlay as any);
        return () => window.removeEventListener('krew:play' as any, handleImperativePlay as any);
    }, [isHost, connectedJam, socket]);

    // Track seeking state locally to suppress pause events
    useEffect(() => {
        if (!audio) return;

        const onSeeking = () => { isSeeking.current = true; };
        const onSeeked = () => {
            // Small delay to allow playing state to recover if needed, 
            // though typically seeked -> play happens fast.
            setTimeout(() => {
                isSeeking.current = false;
            }, 50);
        };

        audio.addEventListener('seeking', onSeeking);
        audio.addEventListener('seeked', onSeeked);

        return () => {
            audio.removeEventListener('seeking', onSeeking);
            audio.removeEventListener('seeked', onSeeked);
        };
    }, [audio]);

    // Host seek broadcasting
    useEffect(() => {
        if (!connectedJam || !socket || !audio) return;

        const handleSeek = () => {
            // Avoid duplicate events if we just received a sync (though loop is unlikely for host)
            if (usePlayerStore.getState().isRemoteUpdate) return;

            socket.emit('jam:seek', {
                jam_id: connectedJam,
                token: localStorage.getItem('token'),
                position: audio.currentTime
            });
        };

        audio.addEventListener('seeked', handleSeek);
        return () => audio.removeEventListener('seeked', handleSeek);
    }, [isHost, connectedJam, socket, audio]);

    // Play/Pause broadcasting
    useEffect(() => {
        if (!connectedJam || !socket || !currentSong) return;

        // Use audio ref from store if available, or just send 0 if not ready
        const position = audio ? audio.currentTime : 0;
        const token = localStorage.getItem('token');
        const songId = currentSong.id;

        // DEBUG: Trace why we are not emitting
        // console.log(`JamManager Check: Host=${isHost}, Jam=${connectedJam}, Playing=${isPlaying}`);
        // if (isPlaying) toast.info(`Jam Debug: Host=${isHost} Play=${songId}`);

        // Prevent Loop: Only broadcast if the intended state has actually changed from what we last sent
        // CRITICAL: We MUST broadcast if the song ID changed, regardless of isPlaying state
        // Prevent Loop: Only broadcast if the intended state has actually changed from what we last sent
        // CRITICAL: We MUST broadcast if the song ID changed, regardless of isPlaying state
        // if (
        //     lastBroadcastState.current.isPlaying === isPlaying &&
        //     lastBroadcastState.current.songId === songId
        // ) {
        //     console.log(`JamManager Skip: Same State (Play=${isPlaying}, Song=${songId})`);
        //     return;
        // }

        // Prevent Loop: Don't broadcast events triggered by the server itself
        if (usePlayerStore.getState().isRemoteUpdate) {
            console.log("JamManager: Suppressing echo broadcast (isRemoteUpdate=true)");
            // However, if the SONG ID changed, we probably entered a new song manually while a seek happened remotely?
            // Unlikely, but safety: if songId changed, we MIGHT want to emit. 
            // For now, trust the flag.
            return;
        }

        if (isPlaying) {
            console.log("JamManager: Emitting Play");
            socket.emit('jam:play', {
                jam_id: connectedJam,
                token,
                song_id: currentSong.id,
                position
            });
            console.log("JamManager: Play sync sent");
        } else {
            // Don't broadcast pause if we are just dragging the slider (seeking)
            if (isSeeking.current) return;

            socket.emit('jam:pause', {
                jam_id: connectedJam,
                token,
                song_id: songId,
                position
            });
        }

        // Update last broadcast state
        lastBroadcastState.current = { isPlaying, songId };

    }, [isHost, connectedJam, isPlaying, currentSong?.id]); // Removed audio from dep to avoid seek loops triggering play/pause logic mistakenly

    // return null; // Headless component
    if (!connectedJam) return null;

    // Headless component - logic only
    return null;
}
