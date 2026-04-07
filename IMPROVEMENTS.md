# Krew Mobile App Improvements

This document outlines the improvements made to enhance the Capacitor music streaming app.

## ✅ Completed Improvements

### 1. Enhanced Capacitor Configuration
- **File**: `capacitor.config.ts`
- **Changes**:
  - Switched to HTTPS scheme for better security
  - Added proper navigation allowlist for API and CDN domains
  - Configured Android and iOS specific settings
  - Added SplashScreen configuration
  - Enabled background audio support

### 2. Offline Caching System
- **File**: `src/lib/offlineCache.ts`
- **Features**:
  - Cache songs for offline playback
  - Store song metadata and audio files
  - Manage cache size and cleanup
  - Get all cached songs
  - Check if song is cached
- **Note**: Currently uses localStorage as fallback. For full native file system support, install `@capacitor/filesystem`.

### 3. Retry Handler with Exponential Backoff
- **File**: `src/lib/retryHandler.ts`
- **Features**:
  - Automatic retry for failed API calls
  - Exponential backoff strategy
  - Configurable retry options
  - Network error detection
  - Retryable status code handling

### 4. App State Persistence
- **File**: `src/lib/appState.ts`
- **Features**:
  - Save player state (current song, queue, volume, shuffle, repeat)
  - Save auth state
  - Restore state on app restart
  - Auto-save on app background
  - Periodic state saving

### 5. Enhanced Queue Management
- **File**: `src/components/QueuePanel.tsx`
- **New Features**:
  - Remove songs from queue
  - Play next functionality
  - Clear entire queue
  - Better UI with action buttons
  - Song numbering in queue

### 6. Network Status Monitoring
- **File**: `src/hooks/useNetworkStatus.ts`
- **Features**:
  - Monitor network connectivity
  - Detect connection type (WiFi, cellular, none)
  - Real-time status updates
  - Works on both web and native

### 7. Improved API Error Handling
- **File**: `src/lib/api.ts`
- **Changes**:
  - Added timeout configuration (30 seconds)
  - Better error messages
  - Integration with retry handler
  - Network error detection

## 📦 Required Dependencies

To fully utilize all features, install these Capacitor plugins:

```bash
npm install @capacitor/filesystem @capacitor/network @capacitor/preferences
npx cap sync
```

### Plugin Usage:

1. **@capacitor/filesystem**: For offline song caching
   - Currently using localStorage fallback
   - Install for native file system access

2. **@capacitor/network**: For network status monitoring
   - Currently using navigator.onLine fallback
   - Install for native network detection

3. **@capacitor/preferences**: For app state persistence
   - Currently using localStorage
   - Install for native secure storage

## 🚀 Usage Examples

### Using Offline Cache

```typescript
import { offlineCache } from '@/lib/offlineCache';

// Cache a song
await offlineCache.cacheSong({
  id: 123,
  title: 'Song Title',
  artist: 'Artist Name',
  audioUrl: 'https://...',
  cachedAt: Date.now()
});

// Check if cached
const isCached = await offlineCache.isSongCached(123);

// Get cached URL
const cachedUrl = await offlineCache.getCachedSongUrl(123);
```

### Using Retry Handler

```typescript
import { createRetryableRequest } from '@/lib/retryHandler';

const result = await createRetryableRequest(
  () => api.get('/songs'),
  {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000
  }
);
```

### Using Network Status

```typescript
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

function MyComponent() {
  const { connected, connectionType, isOnline } = useNetworkStatus();
  
  if (!isOnline) {
    return <div>You're offline</div>;
  }
  
  return <div>Connected via {connectionType}</div>;
}
```

## 🔄 Next Steps

1. **Install Capacitor Plugins**: Run the npm install commands above
2. **Update Offline Cache**: Replace localStorage with Filesystem API
3. **Update Network Hook**: Use Capacitor Network plugin
4. **Update App State**: Use Capacitor Preferences for native storage
5. **Test on Device**: Build and test on Android/iOS device

## 📝 Notes

- All improvements are backward compatible
- Fallbacks are in place for web and when plugins aren't installed
- The app will work without the plugins, but with limited functionality
- Native features require the plugins to be installed and synced

## 🐛 Known Issues

- Offline cache uses localStorage (limited storage)
- Network status uses navigator.onLine (less accurate on native)
- App state uses localStorage (not encrypted on native)

These will be resolved once the Capacitor plugins are installed.
