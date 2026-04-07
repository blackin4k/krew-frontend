import React, { useDeferredValue, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ChevronRight,
  Clock3,
  Disc3,
  Download,
  Heart,
  ListMusic,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { API_URL, apiCall, browseApi, libraryApi, playlistsApi } from '@/lib/api';
import { Album, Playlist, Song } from '@/types/music';
import SongCard from '@/components/SongCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useOfflineStore } from '@/stores/offlineStore';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useAuthStore } from '@/stores/authStore';

const LIBRARY_CACHE_KEY = 'krew_library_cache_v1';
const LIBRARY_CACHE_TTL = 5 * 60 * 1000;

type OverviewFilter = 'all' | 'songs' | 'playlists' | 'artists' | 'albums' | 'offline';

interface LibraryCache {
  likedSongs: Song[];
  recentSongs: Song[];
  playlists: Playlist[];
  albums: Album[];
  artists: string[];
  timestamp: number;
  userKey: string;
}

function loadLibraryCache(userKey: string): LibraryCache | null {
  try {
    const raw = localStorage.getItem(LIBRARY_CACHE_KEY);
    if (!raw) return null;

    const cache = JSON.parse(raw) as LibraryCache;
    const isExpired = Date.now() - cache.timestamp > LIBRARY_CACHE_TTL;

    if (isExpired || cache.userKey !== userKey) {
      return null;
    }

    return cache;
  } catch {
    return null;
  }
}

function saveLibraryCache(cache: LibraryCache) {
  try {
    localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage failures.
  }
}

function toCoverUrl(asset?: string | null) {
  if (!asset) return null;
  if (/^https?:\/\//i.test(asset)) return asset;

  const normalized = asset.replace(/^\/+/, '');
  const base = API_URL.endsWith('/') ? API_URL : `${API_URL}/`;

  if (normalized.startsWith('covers/')) {
    return `${base}${normalized}`;
  }

  return `${base}covers/${normalized}`;
}

function getArtistGradient(name: string) {
  let hash = 0;

  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `linear-gradient(135deg, hsl(${hue} 68% 42%), hsl(${(hue + 36) % 360} 64% 28%))`;
}

function matchesSong(song: Song, query: string) {
  if (!query) return true;

  return [song.title, song.artist, song.album, song.genre]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(query));
}

function matchesPlaylist(playlist: Playlist, query: string) {
  if (!query) return true;

  return playlist.name.toLowerCase().includes(query);
}

function matchesAlbum(album: Album, query: string) {
  if (!query) return true;

  return [album.album, album.artist].some((value) => value.toLowerCase().includes(query));
}

function matchesArtist(artist: string, query: string) {
  if (!query) return true;

  return artist.toLowerCase().includes(query);
}

const PlaylistRow = React.memo(
  ({
    playlist,
    index,
    navigate,
  }: {
    playlist: Playlist;
    index: number;
    navigate: (path: string) => void;
  }) => (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={() => navigate(`/playlist/${playlist.id}`)}
      className="group flex w-full items-center justify-between rounded-[20px] border border-white/5 bg-[#131316] p-3 text-left transition-all hover:border-white/10 hover:bg-[#1c1c20]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-[16px] border border-white/5 bg-[#151518] shadow-sm">
          {playlist.cover ? (
            <img src={toCoverUrl(playlist.cover) ?? undefined} alt={playlist.name} className="h-full w-full object-cover" />
          ) : playlist.songs && playlist.songs.length > 0 ? (
            <div className="grid h-full w-full grid-cols-2 grid-rows-2">
              {Array.from({ length: 4 }).map((_, tileIndex) => {
                const cover = playlist.songs?.[tileIndex]?.cover;
                const url = toCoverUrl(cover);

                return url ? (
                  <img key={tileIndex} src={url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div key={tileIndex} className="h-full w-full border-[0.5px] border-black/20 bg-[#1A1A1D]" />
                );
              })}
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#1A1A1D]">
              <ListMusic className="h-7 w-7 text-white/20" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 pr-4">
          <h3 className="truncate text-[16px] font-semibold text-white">{playlist.name}</h3>
          <div className="mt-1 flex items-center gap-2 text-[13px] text-[#9CA3AF]">
            <span>Playlist</span>
            <span className="h-1 w-1 rounded-full bg-[#333]" />
            <span>{playlist.songs?.length ?? 0} songs</span>
          </div>
        </div>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-[#9CA3AF] opacity-0 transition-opacity group-hover:opacity-100" />
    </motion.button>
  )
);

const AlbumRow = React.memo(
  ({
    album,
    index,
    navigate,
  }: {
    album: Album;
    index: number;
    navigate: (path: string) => void;
  }) => (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={() => navigate(`/album/${encodeURIComponent(album.album)}`)}
      className="group flex w-full items-center justify-between rounded-[20px] border border-white/5 bg-[#131316] p-3 text-left transition-all hover:border-white/10 hover:bg-[#1c1c20]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-[16px] border border-white/5 bg-[#151518] shadow-sm">
          {album.cover ? (
            <img src={toCoverUrl(album.cover) ?? undefined} alt={album.album} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#1A1A1D]">
              <Disc3 className="h-7 w-7 text-white/20" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 pr-4">
          <h3 className="truncate text-[16px] font-semibold text-white">{album.album}</h3>
          <div className="mt-1 flex items-center gap-2 text-[13px] text-[#9CA3AF]">
            <span>Album</span>
            <span className="h-1 w-1 rounded-full bg-[#333]" />
            <span className="truncate">{album.artist}</span>
          </div>
        </div>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-[#9CA3AF] opacity-0 transition-opacity group-hover:opacity-100" />
    </motion.button>
  )
);

const ArtistRow = React.memo(
  ({
    artist,
    index,
    navigate,
  }: {
    artist: string;
    index: number;
    navigate: (path: string) => void;
  }) => (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={() => navigate(`/artist/${encodeURIComponent(artist)}`)}
      className="group flex w-full items-center justify-between rounded-[20px] border border-white/5 bg-[#131316] p-3 text-left transition-all hover:border-white/10 hover:bg-[#1c1c20]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div
          className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-full border border-white/5 shadow-sm"
          style={{ background: getArtistGradient(artist) }}
        >
          <span className="text-xl font-bold text-white/90">{artist.charAt(0).toUpperCase()}</span>
        </div>

        <div className="min-w-0 flex-1 pr-4">
          <h3 className="truncate text-[16px] font-semibold text-white">{artist}</h3>
          <div className="mt-1 flex items-center gap-2 text-[13px] text-[#9CA3AF]">
            <span>Artist</span>
          </div>
        </div>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-[#9CA3AF] opacity-0 transition-opacity group-hover:opacity-100" />
    </motion.button>
  )
);

const LibraryMetricCard = React.memo(
  ({
    title,
    subtitle,
    count,
    icon: Icon,
    onClick,
    accentClassName,
  }: {
    title: string;
    subtitle: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    accentClassName: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[132px] w-full flex-col justify-between rounded-[28px] border border-white/5 bg-[#141417] p-5 text-left transition-all hover:border-white/10 hover:bg-[#1b1b20]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg', accentClassName)}>
          <Icon className="h-6 w-6" />
        </div>
        <ChevronRight className="h-5 w-5 text-white/30 transition-colors group-hover:text-white/70" />
      </div>

      <div>
        <div className="text-[28px] font-bold tracking-tight text-white">{count}</div>
        <div className="text-[16px] font-semibold text-white/90">{title}</div>
        <div className="mt-1 text-[13px] text-[#9CA3AF]">{subtitle}</div>
      </div>
    </button>
  )
);

function SectionHeading({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[22px] font-bold tracking-tight text-white">{title}</h2>
        <p className="mt-1 text-[14px] text-[#9CA3AF]">{subtitle}</p>
      </div>

      {actionLabel && onAction ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onAction}
          className="rounded-full px-4 text-white/70 hover:bg-white/5 hover:text-white"
        >
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

function StateBlock({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[28px] border border-dashed border-white/10 bg-[#111114] px-6 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
        <Icon className="h-8 w-8 text-white/35" />
      </div>
      <h2 className="mt-5 text-[20px] font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-md text-[14px] leading-6 text-[#9CA3AF]">{description}</p>
      {actionLabel && onAction ? (
        <Button type="button" onClick={onAction} className="mt-6 rounded-full">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

const Library = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const downloadedSongs = useOfflineStore((state) => state.downloadedSongs);
  const { connected } = useNetworkStatus();
  const user = useAuthStore((state) => state.user);
  const mountedRef = useRef(true);
  const userKey = user?.username || 'guest';

  const [likedSongs, setLikedSongs] = useState<Song[]>([]);
  const [recentSongs, setRecentSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<OverviewFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const deferredSearch = useDeferredValue(searchQuery.trim().toLowerCase());
  const isMainLibrary = location.pathname === '/library';

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hasLibraryData =
    likedSongs.length > 0 ||
    recentSongs.length > 0 ||
    playlists.length > 0 ||
    albums.length > 0 ||
    artists.length > 0;
  const hasVisibleData = hasLibraryData || downloadedSongs.length > 0;

  const filteredLikedSongs = likedSongs.filter((song) => matchesSong(song, deferredSearch));
  const filteredRecentSongs = recentSongs.filter((song) => matchesSong(song, deferredSearch));
  const filteredPlaylists = playlists.filter((playlist) => matchesPlaylist(playlist, deferredSearch));
  const filteredAlbums = albums.filter((album) => matchesAlbum(album, deferredSearch));
  const filteredArtists = artists.filter((artist) => matchesArtist(artist, deferredSearch));
  const filteredDownloads = downloadedSongs.filter((song) => matchesSong(song, deferredSearch));

  const visibleSongResults = filteredLikedSongs.length + filteredRecentSongs.length;
  const activeFilterHasResults =
    activeFilter === 'all'
      ? visibleSongResults + filteredPlaylists.length + filteredAlbums.length + filteredArtists.length + filteredDownloads.length > 0
      : activeFilter === 'songs'
        ? visibleSongResults > 0
        : activeFilter === 'playlists'
          ? filteredPlaylists.length > 0
          : activeFilter === 'artists'
            ? filteredArtists.length > 0
            : activeFilter === 'albums'
              ? filteredAlbums.length > 0
              : filteredDownloads.length > 0;

  const routeTabs = [
    { to: '/library', label: 'Overview', end: true },
    { to: '/library/liked', label: `Liked ${likedSongs.length > 0 ? `(${likedSongs.length})` : ''}`.trim() },
    { to: '/library/recent', label: `Recent ${recentSongs.length > 0 ? `(${recentSongs.length})` : ''}`.trim() },
    { to: '/library/playlists', label: `Playlists ${playlists.length > 0 ? `(${playlists.length})` : ''}`.trim() },
    { to: '/library/offline', label: `Offline ${downloadedSongs.length > 0 ? `(${downloadedSongs.length})` : ''}`.trim() },
  ];

  const overviewFilters: { key: OverviewFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'songs', label: 'Songs' },
    { key: 'playlists', label: 'Playlists' },
    { key: 'artists', label: 'Artists' },
    { key: 'albums', label: 'Albums' },
    { key: 'offline', label: 'Offline' },
  ];

  const fetchLibrary = async (mode: 'initial' | 'refresh' | 'background' = 'initial') => {
    if (mode === 'refresh') {
      if (mountedRef.current) {
        setRefreshing(true);
      }
    } else if (mode === 'initial' && !hasVisibleData && mountedRef.current) {
      setLoading(true);
    }

    if (mountedRef.current) {
      setLoadError(null);
    }

    try {
      const [likedRes, recentRes, playlistsRes, albumsRes, artistsRes] = await Promise.all([
        apiCall(() => libraryApi.getLiked()),
        apiCall(() => libraryApi.getRecent()),
        apiCall(() => playlistsApi.getAll()),
        apiCall(() => browseApi.albums()),
        apiCall(() => browseApi.artists()),
      ]);

      if (!mountedRef.current) return;

      const nextLikedSongs = likedRes.data || [];
      const nextRecentSongs = recentRes.data || [];
      const nextPlaylists = playlistsRes.data || [];
      const nextAlbums = albumsRes.data || [];
      const nextArtists = artistsRes.data || [];

      setLikedSongs(nextLikedSongs);
      setRecentSongs(nextRecentSongs);
      setPlaylists(nextPlaylists);
      setAlbums(nextAlbums);
      setArtists(nextArtists);
      setLoadError(null);

      saveLibraryCache({
        likedSongs: nextLikedSongs,
        recentSongs: nextRecentSongs,
        playlists: nextPlaylists,
        albums: nextAlbums,
        artists: nextArtists,
        timestamp: Date.now(),
        userKey,
      });
    } catch (error) {
      console.error('Failed to fetch library:', error);

      if (!mountedRef.current) return;

      setLoadError(
        connected
          ? 'We could not refresh your library right now.'
          : 'You are offline. Showing what is available on this device.'
      );
    } finally {
      if (!mountedRef.current) return;

      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const cached = loadLibraryCache(userKey);

    if (cached) {
      setLikedSongs(cached.likedSongs || []);
      setRecentSongs(cached.recentSongs || []);
      setPlaylists(cached.playlists || []);
      setAlbums(cached.albums || []);
      setArtists(cached.artists || []);
      setLoading(false);
    } else {
      setLikedSongs([]);
      setRecentSongs([]);
      setPlaylists([]);
      setAlbums([]);
      setArtists([]);
      setLoading(true);
    }

    void fetchLibrary(cached || downloadedSongs.length > 0 ? 'background' : 'initial');
  }, [userKey]);

  const handleCreatePlaylist = async () => {
    const trimmedName = newPlaylistName.trim();

    if (!trimmedName || creatingPlaylist) {
      return;
    }

    try {
      setCreatingPlaylist(true);

      const response = await playlistsApi.create(trimmedName);
      const createdPlaylist: Playlist = {
        id: response.data?.id ?? Date.now(),
        name: response.data?.name ?? trimmedName,
        cover: response.data?.cover,
        songs: response.data?.songs ?? [],
      };

      setPlaylists((current) => [...current, createdPlaylist]);
      setNewPlaylistName('');
      setDialogOpen(false);

      toast({
        title: 'Playlist created',
        description: `"${createdPlaylist.name}" is ready.`,
      });
    } catch (error) {
      console.error('Failed to create playlist:', error);
      toast({
        title: 'Could not create playlist',
        description: 'Try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      if (mountedRef.current) {
        setCreatingPlaylist(false);
      }
    }
  };

  const renderOverview = () => {
    if (loading && !hasVisibleData) {
      return (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-[132px] animate-pulse rounded-[28px] bg-white/5" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-[24px] bg-white/5" />
            ))}
          </div>
        </div>
      );
    }

    if (!activeFilterHasResults) {
      if (deferredSearch) {
        return (
          <StateBlock
            icon={Search}
            title={`No matches for "${searchQuery.trim()}"`}
            description="Try a different search term, or switch filters to browse another part of your library."
            actionLabel="Clear Search"
            onAction={() => setSearchQuery('')}
          />
        );
      }

      if (activeFilter === 'offline') {
        return (
          <StateBlock
            icon={Download}
            title="No offline songs yet"
            description="Download tracks from anywhere in the app and they will show up here for offline playback."
            actionLabel="Open Offline Library"
            onAction={() => navigate('/library/offline')}
          />
        );
      }

      return (
        <StateBlock
          icon={ListMusic}
          title="Your library is still empty"
          description="Like songs, create playlists, and explore artists and albums to turn this page into your real collection."
          actionLabel="Go To Search"
          onAction={() => navigate('/search')}
        />
      );
    }

    return (
      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-3">
          <LibraryMetricCard
            title="Liked Songs"
            subtitle="Your saved favorites"
            count={likedSongs.length}
            icon={Heart}
            accentClassName="bg-gradient-to-br from-[#2c63ff] via-[#7a8fff] to-[#c5dbff]"
            onClick={() => navigate('/library/liked')}
          />
          <LibraryMetricCard
            title="Recently Played"
            subtitle="Pick up where you left off"
            count={recentSongs.length}
            icon={Clock3}
            accentClassName="bg-gradient-to-br from-[#0f766e] via-[#14b8a6] to-[#99f6e4]"
            onClick={() => navigate('/library/recent')}
          />
          <LibraryMetricCard
            title="Offline Downloads"
            subtitle="Available without a connection"
            count={downloadedSongs.length}
            icon={Download}
            accentClassName="bg-gradient-to-br from-[#7c3aed] via-[#a855f7] to-[#e9d5ff]"
            onClick={() => navigate('/library/offline')}
          />
        </div>

        {(activeFilter === 'all' || activeFilter === 'songs') && filteredLikedSongs.length > 0 ? (
          <section>
            <SectionHeading
              title="Liked Songs"
              subtitle="The tracks you have explicitly saved."
              actionLabel="View All"
              onAction={() => navigate('/library/liked')}
            />
            <div className="space-y-1">
              {filteredLikedSongs.slice(0, 5).map((song, index) => (
                <SongCard key={`${song.id}-liked-${index}`} song={song} index={index} variant="list" />
              ))}
            </div>
          </section>
        ) : null}

        {(activeFilter === 'all' || activeFilter === 'songs') && filteredRecentSongs.length > 0 ? (
          <section>
            <SectionHeading
              title="Recently Played"
              subtitle="Quick access to the songs you have been listening to."
              actionLabel="View All"
              onAction={() => navigate('/library/recent')}
            />
            <div className="space-y-1">
              {filteredRecentSongs.slice(0, 5).map((song, index) => (
                <SongCard key={`${song.id}-recent-${index}`} song={song} index={index} variant="list" />
              ))}
            </div>
          </section>
        ) : null}

        {(activeFilter === 'all' || activeFilter === 'playlists') && filteredPlaylists.length > 0 ? (
          <section>
            <SectionHeading
              title="Playlists"
              subtitle="Organized collections for every mood."
              actionLabel="View All"
              onAction={() => navigate('/library/playlists')}
            />
            <div className="space-y-3">
              {filteredPlaylists.slice(0, activeFilter === 'playlists' ? filteredPlaylists.length : 6).map((playlist, index) => (
                <PlaylistRow key={playlist.id} playlist={playlist} index={index} navigate={navigate} />
              ))}
            </div>
          </section>
        ) : null}

        {(activeFilter === 'all' || activeFilter === 'albums') && filteredAlbums.length > 0 ? (
          <section>
            <SectionHeading
              title="Albums"
              subtitle="Full-length releases from across your library."
              actionLabel="View All"
              onAction={() => navigate('/albums')}
            />
            <div className="space-y-3">
              {filteredAlbums.slice(0, activeFilter === 'albums' ? filteredAlbums.length : 6).map((album, index) => (
                <AlbumRow key={`${album.album}-${album.artist}`} album={album} index={index} navigate={navigate} />
              ))}
            </div>
          </section>
        ) : null}

        {(activeFilter === 'all' || activeFilter === 'artists') && filteredArtists.length > 0 ? (
          <section>
            <SectionHeading
              title="Artists"
              subtitle="People behind the music in your collection."
              actionLabel="View All"
              onAction={() => navigate('/artists')}
            />
            <div className="space-y-3">
              {filteredArtists.slice(0, activeFilter === 'artists' ? filteredArtists.length : 6).map((artist, index) => (
                <ArtistRow key={artist} artist={artist} index={index} navigate={navigate} />
              ))}
            </div>
          </section>
        ) : null}

        {(activeFilter === 'all' || activeFilter === 'offline') && filteredDownloads.length > 0 ? (
          <section>
            <SectionHeading
              title="Offline Downloads"
              subtitle="Songs saved locally on this device."
              actionLabel="Open Offline Library"
              onAction={() => navigate('/library/offline')}
            />
            <div className="space-y-1">
              {filteredDownloads.slice(0, activeFilter === 'offline' ? filteredDownloads.length : 5).map((song, index) => (
                <SongCard key={`${song.id}-offline-${index}`} song={song} index={index} variant="list" />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen w-full overflow-hidden bg-[#0A0A0C] px-4 pb-40 pt-4 font-sans md:px-8 md:pb-32">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-[calc(env(safe-area-inset-top)+1rem)]"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-[34px] font-bold tracking-tight text-white/95">Library</h1>
            <p className="mt-2 text-[14px] text-[#9CA3AF]">
              Your saved music, playlists, artists, albums, and offline downloads in one place.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void fetchLibrary('refresh')}
              disabled={refreshing}
              className="rounded-full bg-[#151518] text-white hover:bg-[#1f1f24]"
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
              Refresh
            </Button>

            <Button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="rounded-full bg-white text-black hover:bg-white/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Playlist
            </Button>
          </div>
        </div>

        <div className="mt-6 flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {routeTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap rounded-full border px-4 py-2 text-[14px] font-medium transition-colors',
                  isActive
                    ? 'border-white bg-white text-black'
                    : 'border-white/10 bg-[#151518] text-[#9CA3AF] hover:border-white/15 hover:text-white'
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>

        {loadError ? (
          <div className="mt-4 flex items-start gap-3 rounded-[20px] border border-amber-400/20 bg-amber-500/10 p-4 text-amber-100">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
            <div>
              <p className="font-medium">{loadError}</p>
              <p className="mt-1 text-sm text-amber-100/80">
                {hasVisibleData
                  ? 'Some sections may be showing cached data while the connection recovers.'
                  : 'Try refreshing again, or use offline downloads if you have them saved.'}
              </p>
            </div>
          </div>
        ) : null}

        {!connected ? (
          <div className="mt-4 rounded-[20px] border border-white/10 bg-white/5 p-4 text-sm text-[#D1D5DB]">
            Offline mode is active. Online sections may be stale, but downloaded songs remain available on this device.
          </div>
        ) : null}

        {isMainLibrary ? (
          <div className="mt-6 space-y-6">
            <div className="rounded-[28px] border border-white/5 bg-[#101013] p-4 md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-md">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search songs, playlists, albums, artists, or downloads..."
                    className="h-12 rounded-full border-white/10 bg-[#16161A] pl-11 pr-11 text-white placeholder:text-[#6B7280] focus-visible:ring-white/20"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280] transition-colors hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {overviewFilters.map((filter) => (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setActiveFilter(filter.key)}
                      className={cn(
                        'whitespace-nowrap rounded-full border px-4 py-2 text-[13px] font-medium transition-colors',
                        activeFilter === filter.key
                          ? 'border-white bg-white text-black'
                          : 'border-white/10 bg-[#151518] text-[#9CA3AF] hover:text-white'
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {renderOverview()}
          </div>
        ) : (
          <div className="mt-6">
            <Outlet />
          </div>
        )}
      </motion.div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-white/10 bg-[#121216] text-white">
          <DialogHeader>
            <DialogTitle>Create Playlist</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <Input
              placeholder="Playlist name"
              value={newPlaylistName}
              maxLength={80}
              onChange={(event) => setNewPlaylistName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void handleCreatePlaylist();
                }
              }}
              className="border-white/10 bg-[#1A1A1F] text-white placeholder:text-[#6B7280]"
            />

            <Button
              type="button"
              onClick={() => void handleCreatePlaylist()}
              disabled={!newPlaylistName.trim() || creatingPlaylist}
              className="w-full"
            >
              {creatingPlaylist ? 'Creating...' : 'Create Playlist'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Library;
