import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { usePlayerStore } from '@/stores/playerStore';
import { useJamStore } from '@/stores/jamStore';
import { songsApi } from '@/lib/api';
import { toast } from 'sonner';

const DeepLinkHandler = () => {
    const navigate = useNavigate();
    const { playSong, setExpanded } = usePlayerStore();
    const { setJamId } = useJamStore();

    useEffect(() => {
        let listener: any;

        App.addListener('appUrlOpen', async (event) => {
            const url = new URL(event.url);
            let type = '';
            let id = '';

            if (url.protocol === 'https:' && url.host === 'api.kreewaux.xyz') {
                const parts = url.pathname.split('/').filter(Boolean);
                if (parts.length >= 2) {
                    type = parts[0];
                    id = parts[1];
                }
            } else if (url.protocol.includes('krew')) {
                type = url.host;
                id = url.pathname.replace('/', '');
            }

            if (type === 'song' && id) {
                try {
                    const res = await songsApi.get(parseInt(id));
                    playSong(res.data);
                    setExpanded(true);
                } catch {
                    toast.error('Could not load shared song.');
                }
            }
        }).then(handle => {
            listener = handle;
        });

        return () => {
            listener?.remove();
        };
    }, [navigate]);

    return null;
};

export default DeepLinkHandler;
