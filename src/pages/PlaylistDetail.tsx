import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { playlistsApi, songsApi } from '@/lib/api';
import { usePlayerStore } from '@/stores/playerStore';
import { Song, Playlist } from '@/types/music';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  ListMusic,
  Play,
  Pause,
  GripVertical,
  Trash2,
  ArrowLeft,
  Music,
  Clock,
  Plus,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useDominantColor } from '@/hooks/useDominantColor';
import { API_URL } from '@/lib/api'; // Ensure API_URL is available

const PlaylistDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);

  const { currentSong, isPlaying, playCollection } = usePlayerStore();

  const loadPlaylist = () => {
    if (!id) return;

    playlistsApi
      .get(Number(id))
      .then((res) => {
        setPlaylist(res.data);
        setSongs(res.data.songs || []);
      })
      .catch(() => {
        toast({
          title: 'Error',
          description: 'Failed to load playlist',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadPlaylist();
  }, [id, toast, refreshKey]);

  // Search songs for adding to playlist
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      songsApi
        .search(searchQuery)
        .then((res) => {
          const results = res.data || [];
          // Filter out songs already in playlist
          const filtered = results.filter(
            (song) => !songs.some((s) => s.id === song.id)
          );
          setSearchResults(filtered);
        })
        .catch(() => setSearchResults([]));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, songs]);

  const handleAddSongToPlaylist = async (songId: number) => {
    if (!id) return;

    try {
      await playlistsApi.addSong(Number(id), songId);
      toast({ title: 'Song added to playlist' });
      setRefreshKey((prev) => prev + 1);
      setSearchQuery('');
      setSearchDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add song',
        variant: 'destructive',
      });
    }
  };

  const handleDeletePlaylist = async () => {
    if (!id) return;

    try {
      await playlistsApi.delete(Number(id));
      toast({ title: 'Playlist deleted' });
      navigate('/library/playlists');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete playlist',
        variant: 'destructive',
      });
    }
  };

  const handlePlayAll = async () => {
    if (!id || songs.length === 0) return;
    try {
      await playCollection(songs);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to play playlist',
        variant: 'destructive',
      });
    }
  };

  const handlePlaySong = async (song: Song) => {
    try {
      const songIndex = songs.findIndex((item) => item.id === song.id);
      if (songIndex < 0) return;
      await playCollection(songs, songIndex);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to play song',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveSong = async (songId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!id) return;

    try {
      await playlistsApi.removeSong(Number(id), songId);
      setSongs(songs.filter((s) => s.id !== songId));
      toast({ title: 'Song removed from playlist' });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to remove song',
        variant: 'destructive',
      });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !id) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;

    if (sourceIndex === destIndex) return;

    const reorderedSongs = Array.from(songs);
    const [movedSong] = reorderedSongs.splice(sourceIndex, 1);
    reorderedSongs.splice(destIndex, 0, movedSong);

    setSongs(reorderedSongs);

    // Send reorder request to backend
    try {
      await playlistsApi.reorder?.(Number(id), reorderedSongs.map((s) => s.id));
    } catch {
      // If API doesn't support reorder, silently fail (optimistic update stays)
    }
  };

  if (loading) {
    return (
      <div className="p-6 pb-32">
        <div className="animate-pulse space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-48 h-48 rounded-xl bg-muted" />
            <div className="space-y-2">
              <div className="h-8 w-48 bg-muted rounded" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          </div>
          <div className="space-y-2 mt-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="p-6 pb-32 text-center">
        <ListMusic className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Playlist not found</h2>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go back
        </Button>
      </div>
    );
  }

  // Determine Cover Image
  // 1. Playlist Cover (if exists)
  // 2. First Song Cover (fallback)
  // 3. Null (show icon)
  const coverImage = playlist?.cover
    ? playlist.cover.startsWith('http')
      ? playlist.cover
      : `${API_URL}/covers/${playlist.cover}`
    : songs.length > 0 && songs[0].cover
      ? songs[0].cover.startsWith('http')
        ? songs[0].cover
        : `${API_URL}/covers/${songs[0].cover}`
      : null;

  const domColor = useDominantColor(coverImage);

  // Dynamic Background: Use extracted color or fallback to purple
  const bgStyle = domColor
    ? {
      background: `linear-gradient(to bottom, rgba(${domColor.r},${domColor.g},${domColor.b}, 0.6), transparent)`,
    }
    : {
      background: 'linear-gradient(to bottom, rgba(147, 51, 234, 0.4), transparent)', // fallback purple
    };

  return (
    <div className="pb-32">
      {/* Dynamic Header */}
      <div
        className="pt-8 pb-12 px-6 md:px-8 transition-colors duration-700"
        style={playlist ? bgStyle : undefined}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-48 h-48 rounded-lg shadow-2xl flex-shrink-0 overflow-hidden bg-neutral-800 flex items-center justify-center"
          >
            {coverImage ? (
              <img
                src={coverImage}
                alt={playlist?.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <ListMusic className="h-24 w-24 text-muted-foreground" />
            )}
          </motion.div>

          <div className="flex-1">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center text-sm text-white/70 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </button>
            <p className="text-sm font-medium text-white/70 uppercase tracking-widest">
              Playlist
            </p>
            <h1 className="text-5xl md:text-6xl font-display font-bold mt-2 text-white">
              {playlist?.name}
            </h1>
            <p className="text-white/70 mt-4 text-lg">
              {songs.length} {songs.length === 1 ? 'song' : 'songs'}
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-4 mt-8">
              <Button
                size="lg"
                onClick={handlePlayAll}
                disabled={songs.length === 0}
                className="rounded-full px-8 bg-primary hover:bg-primary/90 font-semibold"
              >
                <Play className="h-5 w-5 mr-2" fill="currentColor" />
                Play
              </Button>

              <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="lg"
                    className="rounded-full px-8 border-gray-400 text-white hover:bg-white/10"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Song
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add song to playlist</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="Search songs..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-12"
                    />
                    {searchResults.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {searchResults.map((song) => (
                          <button
                            key={song.id}
                            onClick={() => handleAddSongToPlaylist(song.id)}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors"
                          >
                            <div className="text-left">
                              <p className="font-medium">{song.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {song.artist}
                              </p>
                            </div>
                            <Plus className="h-5 w-5 text-muted-foreground hover:text-primary" />
                          </button>
                        ))}
                      </div>
                    ) : searchQuery.trim() ? (
                      <p className="text-center text-muted-foreground py-8">
                        No songs found
                      </p>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Search for songs to add
                      </p>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="rounded-full p-2"
                  >
                    <MoreHorizontal className="h-6 w-6" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleDeletePlaylist}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Playlist
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Songs List */}
      <div className="px-6 md:px-8">
        {songs.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-muted rounded-xl">
            <Music className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No songs in this playlist</p>
            <p className="text-sm text-muted-foreground">
              Search for songs to add them here
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Header Row */}
            <div className="hidden sm:grid grid-cols-[40px_1fr_1fr_80px_40px] gap-4 px-4 py-2 text-sm text-muted-foreground border-b border-border">
              <span>#</span>
              <span>Title</span>
              <span>Album</span>
              <span className="flex items-center justify-end">
                <Clock className="h-4 w-4" />
              </span>
              <span />
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="playlist-songs">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-1"
                  >
                    {songs.map((song, index) => (
                      <Draggable
                        key={song.id}
                        draggableId={String(song.id)}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <motion.div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            onClick={() => handlePlaySong(song)}
                            className={`group grid grid-cols-[40px_1fr] sm:grid-cols-[40px_1fr_1fr_80px_40px] gap-4 px-4 py-3 rounded-lg cursor-pointer transition-all ${snapshot.isDragging
                              ? 'bg-secondary shadow-lg'
                              : currentSong?.id === song.id
                                ? 'bg-primary/10'
                                : 'hover:bg-secondary/50'
                              }`}
                          >
                            {/* Drag Handle + Number */}
                            <div className="flex items-center gap-2">
                              <span
                                {...provided.dragHandleProps}
                                className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                              </span>
                              <span className="group-hover:hidden text-muted-foreground w-6 text-center">
                                {currentSong?.id === song.id && isPlaying ? (
                                  <Pause className="h-4 w-4 text-primary" fill="currentColor" />
                                ) : (
                                  index + 1
                                )}
                              </span>
                              <span className="hidden group-hover:block">
                                {currentSong?.id === song.id && isPlaying ? (
                                  <Pause className="h-4 w-4 text-primary" fill="currentColor" />
                                ) : (
                                  <Play className="h-4 w-4 text-primary" fill="currentColor" />
                                )}
                              </span>
                            </div>

                            {/* Title & Artist */}
                            <div className="flex items-center gap-3 min-w-0">
                              {song.cover ? (
                                <img
                                  src={song.cover}
                                  alt={song.title}
                                  className="w-10 h-10 rounded object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                                  <Music className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p
                                  className={`font-medium truncate ${currentSong?.id === song.id
                                    ? 'text-primary'
                                    : ''
                                    }`}
                                >
                                  {song.title}
                                </p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {song.artist}
                                </p>
                              </div>
                            </div>

                            {/* Album (hidden on mobile) */}
                            <p className="hidden sm:block text-sm text-muted-foreground truncate self-center">
                              {song.album || '-'}
                            </p>

                            {/* Duration placeholder (hidden on mobile) */}
                            <p className="hidden sm:block text-sm text-muted-foreground text-right self-center">
                              --:--
                            </p>

                            {/* Remove Button */}
                            <div className="hidden sm:flex items-center justify-center">
                              <button
                                onClick={(e) => handleRemoveSong(song.id, e)}
                                className="p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlaylistDetail;
