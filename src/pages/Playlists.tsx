import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playlistsApi } from '@/lib/api';
import { Playlist } from '@/types/music';
import { ListMusic, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const Playlists = () => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    playlistsApi
      .getAll()
      .then((res) => setPlaylists(res.data || []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!newPlaylistName.trim()) return;

    try {
      const res = await playlistsApi.create(newPlaylistName);
      setPlaylists((prev) => [...prev, res.data]);
      setNewPlaylistName('');
      setDialogOpen(false);
      toast({ title: 'Playlist created!' });
    } catch {
      toast({ title: 'Error', description: 'Failed to create playlist', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await playlistsApi.delete(id);
      setPlaylists(playlists.filter((p) => p.id !== id));
      toast({ title: 'Playlist deleted' });
    } catch {
      toast({ title: 'Error', description: 'Failed to delete playlist', variant: 'destructive' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-xl bg-secondary shadow-lg">
            <ListMusic className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-display font-bold">Playlists</h2>
            <p className="text-muted-foreground">{playlists.length} playlists</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square rounded-xl bg-muted" />
              <div className="mt-3 h-4 bg-muted rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : playlists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {playlists.map((playlist, i) => (
            <motion.div
              key={playlist.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/playlist/${playlist.id}`)}
              className="group relative p-4 rounded-xl bg-card hover:bg-secondary transition-all cursor-pointer hover-lift"
            >
              <div className="aspect-square rounded-lg bg-gradient-to-br from-muted to-secondary flex items-center justify-center mb-3 overflow-hidden">
                {playlist.cover ? (
                  <img
                    src={playlist.cover}
                    alt={playlist.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <ListMusic className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <h3 className="font-semibold truncate">{playlist.name}</h3>
              <p className="text-sm text-muted-foreground">Playlist</p>

              <button
                onClick={(e) => handleDelete(playlist.id, e)}
                className="absolute top-2 right-2 p-2 rounded-full bg-background/80 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <ListMusic className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No playlists yet</p>
          <p className="text-sm text-muted-foreground mb-4">Create your first playlist</p>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Playlist
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Playlist</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input
                  placeholder="Playlist name"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <Button onClick={handleCreate} className="w-full">
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
};

export default Playlists;
