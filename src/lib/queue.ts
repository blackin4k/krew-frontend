export interface QueueResponseShape<T = any> {
  queue: T[];
  currentSongId: number | null;
}

export function normalizeQueueResponse<T = any>(data: any): QueueResponseShape<T> {
  const queue = Array.isArray(data)
    ? data
    : Array.isArray(data?.queue)
      ? data.queue
      : Array.isArray(data?.items)
        ? data.items
        : [];

  const rawCurrentSong =
    data?.current_song ??
    data?.currentSong ??
    data?.now_playing ??
    data?.nowPlaying ??
    null;

  const currentSongId =
    typeof rawCurrentSong === 'number'
      ? rawCurrentSong
      : typeof rawCurrentSong?.id === 'number'
        ? rawCurrentSong.id
        : null;

  return { queue, currentSongId };
}
