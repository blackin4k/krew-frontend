export interface Song {
  id: number;
  title: string;
  artist: string;
  album?: string;
  cover?: string;
  audio?: string;
  genre?: string;
  lyrics?: string;
}

export interface Playlist {
  id: number;
  name: string;
  cover?: string;
  songs?: Song[];
}

export interface Album {
  album: string;
  artist: string;
  tracks: number;
  cover?: string;
}

export interface Genre {
  genre: string;
  count: number;
  cover?: string;
}

export interface Artist {
  artist: string;
  albums: { album: string; cover?: string }[];
  top_tracks: Song[];
}
