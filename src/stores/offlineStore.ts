import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Song } from './playerStore';
import { toast } from 'sonner';
import { playerApi, API_URL } from '@/lib/api';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(blob);
  });
};

export interface OfflineSong extends Song {
  downloadedAt: number;
  filePath: string;
  local: boolean;
  coverFileName?: string;
}

interface OfflineState {
  downloadedSongs: OfflineSong[];
  isDownloading: Record<number, boolean>;
  downloadSong: (song: Song) => Promise<void>;
  removeSong: (songId: number) => Promise<void>;
  isDownloaded: (songId: number) => boolean;
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      downloadedSongs: [],
      isDownloading: {},

      downloadSong: async (song: Song) => {
        // Prevent duplicate downloads
        if (get().isDownloaded(song.id) || get().isDownloading[song.id]) {
          return;
        }

        set((state) => ({
          isDownloading: { ...state.isDownloading, [song.id]: true }
        }));

        toast.info(`Downloading ${song.title}...`);

        try {
          // Phase 2: Capacitor Real File System Download
          const audioUrl = song.audio || (await playerApi.play(song.id)).data?.audio;
          if (!audioUrl) {
            throw new Error(`Missing audio URL for song ${song.id}`);
          }
          const response = await fetch(audioUrl);
          
          if (!response.ok) throw new Error('Download stream failed');
          
          const blob = await response.blob();
          
          // Convert to base64 for Capacitor
          const base64DataWithPrefix = await blobToBase64(blob);
          const base64Data = base64DataWithPrefix.split(',')[1];
          const fileName = `song_${song.id}.mp3`;

          const writeResult = await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Data
          });

          // Phase 2 - Download Cover
          let localCoverUri = song.cover;
          let savedCoverFileName = undefined;
          
          if (song.cover) {
            try {
              let coverUrl = song.cover;
              if (!coverUrl.startsWith('http')) {
                const cleanPath = coverUrl.startsWith('/') ? coverUrl.slice(1) : coverUrl;
                const cleanApiUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
                coverUrl = `${cleanApiUrl}/covers/${cleanPath}`;
              }
              const coverResponse = await fetch(coverUrl);
              if (coverResponse.ok) {
                const coverBlob = await coverResponse.blob();
                const coverBase64WithPrefix = await blobToBase64(coverBlob);
                const coverBase64 = coverBase64WithPrefix.split(',')[1];
                savedCoverFileName = `cover_${song.id}.jpg`;
                
                const coverWriteResult = await Filesystem.writeFile({
                  path: savedCoverFileName,
                  data: coverBase64,
                  directory: Directory.Data
                });
                localCoverUri = coverWriteResult.uri;
              }
            } catch (err) {
              console.warn("Could not download cover for ", song.id, err);
            }
          }

          // Save metadata to localStorage
          const offlineSong: OfflineSong = {
            ...song,
            cover: localCoverUri,
            coverFileName: savedCoverFileName,
            downloadedAt: Date.now(),
            filePath: writeResult.uri, // Real absolute URI
            local: true // Offline file definitely exists
          };

          set((state) => ({
            downloadedSongs: [offlineSong, ...state.downloadedSongs.filter(s => s.id !== song.id)],
            isDownloading: { ...state.isDownloading, [song.id]: false }
          }));

          toast.success(`${song.title} downloaded successfully`);
        } catch (error) {
          console.error("Download failed:", error);
          toast.error(`Failed to download ${song.title}`);
          set((state) => ({
            isDownloading: { ...state.isDownloading, [song.id]: false }
          }));
        }
      },

      removeSong: async (songId: number) => {
        try {
          await Filesystem.deleteFile({
            path: `song_${songId}.mp3`,
            directory: Directory.Data
          });
          
          const song = get().downloadedSongs.find(s => s.id === songId);
          if (song?.coverFileName) {
            await Filesystem.deleteFile({
              path: song.coverFileName,
              directory: Directory.Data
            });
          }
        } catch (e) {
          console.warn("Could not delete from filesystem, it might already be removed:", e);
        }

        set((state) => ({
          downloadedSongs: state.downloadedSongs.filter(s => s.id !== songId)
        }));
        toast.success("Removed from offline downloads");
      },

      isDownloaded: (songId: number) => {
        return get().downloadedSongs.some(s => s.id === songId);
      }
    }),
    {
      name: 'krew-offline-storage'
    }
  )
);
