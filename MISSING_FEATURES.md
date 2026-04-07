# Missing Frontend Features - Backend API Analysis

Based on the backend API (`c:\krewv1\spov1\app.py`), here are the features available in the backend but **NOT implemented** in the frontend:

## 🎵 **Song Upload** ❌
**Backend Endpoint:** `POST /songs/upload`
- **Status:** Not implemented
- **Description:** Users can upload songs with audio files and cover art
- **Backend Support:** ✅ Full support with multipart form data
- **Frontend:** ❌ No upload UI/functionality

---

## 📥 **Spotify Playlist Import** ❌
**Backend Endpoint:** `POST /import/spotify-playlist`
- **Status:** Not implemented
- **Description:** Import playlists from Spotify, matching local songs and tracking unavailable tracks
- **Backend Support:** ✅ Full support with ExternalPlaylistTrack model
- **Frontend:** ❌ No import UI/functionality

**Related Endpoint:**
- `GET /playlists/<pid>/full` - Returns playlist with both available and unavailable tracks
- **Status:** Not implemented in frontend

---

## 🎧 **Radio Features** ⚠️ (Partially Implemented)
**Backend Endpoints:**
- `GET /radio/song/<sid>` - Song radio (similar songs)
- `GET /radio/artist/<artist>` - Artist radio ✅ (Used in ArtistPage)
- `GET /radio/album/<album>` - Album radio ❌
- `GET /because/<sid>` - "Because you listened to..." ❌

**Status:**
- ✅ Artist Radio: Implemented in `ArtistPage.tsx`
- ❌ Song Radio: API exists but no UI
- ❌ Album Radio: API exists but no UI
- ❌ "Because You Listened": Not in API file, no UI

---

## 🎛️ **Queue Management** ⚠️ (Partially Implemented)
**Backend Endpoint:** `POST /player/queue/modify`
- **Actions Supported:**
  - `remove` - Remove songs from queue
  - `play_next` - Add song to play next
  - `clear` - Clear entire queue

**Status:**
- ✅ API function exists in `src/lib/api.ts`
- ❌ Not used in `QueuePanel.tsx` (basic read-only implementation)
- ❌ No UI for queue manipulation (remove, reorder, play next)

---

## 🎪 **Jam Sessions (WebSocket)** ❌
**Backend Support:** Full WebSocket implementation with SocketIO
- **Events:**
  - `jam:join` - Join a jam session
  - `jam:message` - Send messages in jam
  - `jam:vote_skip` - Vote to skip song
  - `jam:host` - Host control
  - `jam:listeners` - List of listeners
  - `jam:skip_votes` - Skip vote status

**Status:**
- ❌ No WebSocket client implementation
- ❌ No Jam session UI
- ❌ No real-time collaboration features

---

## 📊 **Player State Sync** ⚠️ (Partially Implemented)
**Backend Endpoint:** `GET /player/state`
- **Status:** API exists but may not be fully utilized
- **Description:** Syncs current song, shuffle, repeat state from backend
- **Note:** Frontend manages state locally, may not sync on page reload

---

## 🔄 **Playlist Reorder** ⚠️ (Frontend Only)
**Backend Endpoint:** `POST /playlists/<pid>/reorder` 
- **Status:** ❌ **Backend endpoint doesn't exist!**
- **Frontend:** Code exists in `PlaylistDetail.tsx` but backend doesn't support it
- **Issue:** Frontend tries to call this endpoint but backend doesn't have it

---

## 📈 **Analytics/Play Logging** ⚠️ (Partially Implemented)
**Backend Endpoint:** `POST /songs/<sid>/played`
- **Status:** ✅ Called in player store
- **Description:** Logs when songs are played
- **Note:** Backend tracks `listen_duration` and `completed` but frontend doesn't send this data

---

## 🎯 **Search Sorting** ⚠️ (Partially Implemented)
**Backend Endpoint:** `GET /search?sort=plays|recent|relevance`
- **Status:** ✅ API supports sorting
- **Frontend:** Need to verify if sort options are exposed in UI

---

## 📝 **Summary by Priority**

### 🔴 **High Priority Missing Features:**
1. **Song Upload** - Core functionality for user content
2. **Queue Management UI** - Remove songs, play next, clear queue
3. **Playlist Reorder Backend** - Frontend expects this but backend doesn't have it

### 🟡 **Medium Priority Missing Features:**
4. **Spotify Playlist Import** - Nice-to-have feature
5. **Song Radio** - Expand radio features
6. **Album Radio** - Expand radio features
7. **"Because You Listened"** - Discovery feature

### 🟢 **Low Priority / Future Features:**
8. **Jam Sessions** - Requires WebSocket implementation
9. **Full Playlist View** - Show unavailable tracks from Spotify imports
10. **Enhanced Analytics** - Track listen duration and completion

---

## 🔧 **Quick Wins (Easy to Implement):**

1. **Add "Because You Listened" API** to `src/lib/api.ts`:
   ```typescript
   because: (id: number) => api.get(`/because/${id}`)
   ```

2. **Add Song/Album Radio buttons** to respective pages

3. **Enhance QueuePanel** with remove/clear actions using `modifyQueue`

4. **Fix Playlist Reorder** - Either remove from frontend or add backend endpoint

---

## 📋 **Backend Endpoints Not in Frontend API:**

- `POST /songs/upload` - Song upload
- `POST /import/spotify-playlist` - Spotify import
- `GET /playlists/<pid>/full` - Full playlist with unavailable tracks
- `GET /because/<sid>` - Because you listened
- `GET /radio/song/<sid>` - Song radio (exists but not used)
- `GET /radio/album/<album>` - Album radio (exists but not used)

---

## 🎨 **UI Components Needed:**

1. **Upload Page/Modal** - File upload with drag & drop
2. **Spotify Import Modal** - Paste playlist URL or JSON
3. **Enhanced Queue Panel** - With remove, reorder, play next buttons
4. **Radio Buttons** - On song cards, album pages
5. **Jam Session Page** - Real-time collaborative listening
6. **"Because You Listened" Section** - On song/artist pages
