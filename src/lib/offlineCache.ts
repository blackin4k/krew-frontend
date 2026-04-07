/**
 * Offline Cache Manager for Krew Mobile
 * Handles caching of songs, covers, and API responses for offline playback
 */

import { Capacitor } from '@capacitor/core';
// Note: Filesystem plugin needs to be installed: npm install @capacitor/filesystem
// For now, using localStorage as fallback

export interface CachedSong {
  id: number;
  title: string;
  artist: string;
  cover?: string;
  audioUrl: string;
  cachedAt: number;
}

class OfflineCacheManager {
  private cachePrefix = 'krew_cache_';
  private maxCacheSize = 500 * 1024 * 1024; // 500MB default
  private cacheDir = 'krew_offline';

  /**
   * Check if offline caching is available
   */
  isAvailable(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Cache a song's audio file
   */
  async cacheSong(song: CachedSong): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      // Store metadata
      const metadataKey = `${this.cachePrefix}meta_${song.id}`;
      await this.setItem(metadataKey, JSON.stringify(song));

      // Download and cache audio file
      const response = await fetch(song.audioUrl);
      if (!response.ok) throw new Error('Failed to fetch audio');

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      );

      // For now, store in IndexedDB or localStorage
      // TODO: Implement proper file system storage when @capacitor/filesystem is installed
      const audioKey = `audio_${song.id}`;
      localStorage.setItem(audioKey, base64);

      return true;
    } catch (error) {
      console.error('Failed to cache song:', error);
      return false;
    }
  }

  /**
   * Get cached song audio URL
   */
  async getCachedSongUrl(songId: number): Promise<string | null> {
    if (!this.isAvailable()) return null;

    try {
      // TODO: Use Filesystem API when plugin is installed
      const audioKey = `audio_${songId}`;
      const base64Data = localStorage.getItem(audioKey);
      if (!base64Data) return null;

      // Convert base64 to blob URL
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Failed to get cached song:', error);
      return null;
    }
  }

  /**
   * Check if song is cached
   */
  async isSongCached(songId: number): Promise<boolean> {
    if (!this.isAvailable()) return false;

    try {
      const metadataKey = `${this.cachePrefix}meta_${songId}`;
      const metadata = await this.getItem(metadataKey);
      return metadata !== null;
    } catch {
      return false;
    }
  }

  /**
   * Remove cached song
   */
  async removeCachedSong(songId: number): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const metadataKey = `${this.cachePrefix}meta_${songId}`;
      await this.removeItem(metadataKey);

      const audioKey = `audio_${songId}`;
      localStorage.removeItem(audioKey);
    } catch (error) {
      console.error('Failed to remove cached song:', error);
    }
  }

  /**
   * Get all cached songs
   */
  async getAllCachedSongs(): Promise<CachedSong[]> {
    if (!this.isAvailable()) return [];

    try {
      const keys = await this.getAllKeys();
      const songKeys = keys.filter((k) => k.startsWith(`${this.cachePrefix}meta_`));

      const songs: CachedSong[] = [];
      for (const key of songKeys) {
        const metadata = await this.getItem(key);
        if (metadata) {
          songs.push(JSON.parse(metadata));
        }
      }

      return songs.sort((a, b) => b.cachedAt - a.cachedAt);
    } catch (error) {
      console.error('Failed to get cached songs:', error);
      return [];
    }
  }

  /**
   * Get cache size (approximate)
   */
  async getCacheSize(): Promise<number> {
    if (!this.isAvailable()) return 0;

    try {
      // Approximate size calculation from localStorage
      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('audio_') || key.startsWith(this.cachePrefix))) {
          const value = localStorage.getItem(key);
          if (value) {
            // Approximate: each character in base64 is ~1 byte, but base64 is 4/3 larger
            totalSize += value.length * 0.75;
          }
        }
      }
      return totalSize;
    } catch {
      return 0;
    }
  }

  /**
   * Clear all cached songs
   */
  async clearCache(): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const songs = await this.getAllCachedSongs();
      for (const song of songs) {
        await this.removeCachedSong(song.id);
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  // Helper methods for localStorage (fallback for web)
  private async setItem(key: string, value: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      // Use Capacitor Preferences in the future
      localStorage.setItem(key, value);
    } else {
      localStorage.setItem(key, value);
    }
  }

  private async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  }

  private async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  }

  private async getAllKeys(): Promise<string[]> {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.cachePrefix)) {
        keys.push(key);
      }
    }
    return keys;
  }
}

export const offlineCache = new OfflineCacheManager();
