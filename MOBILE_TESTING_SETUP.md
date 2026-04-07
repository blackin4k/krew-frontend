# Mobile Testing Setup Guide

## Step 1: Find Your Computer's IP Address

### Windows:
1. Open PowerShell or Command Prompt
2. Run: `ipconfig`
3. Look for "IPv4 Address" under your active network adapter (usually WiFi or Ethernet)
4. Example: `192.168.1.100`

### Alternative (Windows):
```powershell
(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*"}).IPAddress
```

## Step 2: Update Backend CORS

The backend CORS has been updated to allow local network access. Make sure your backend is running.

## Step 3: Set Frontend API URL

### Option A: Using Environment Variable (Recommended)

1. Create a `.env` file in the frontend root directory (`c:\krewv1\frontend-friend\.env`)
2. Add this line (replace with YOUR IP address):
   ```
   VITE_API_URL=http://192.168.1.100:5000
   ```
   Replace `192.168.1.100` with your actual IP address from Step 1.

### Option B: Temporary Change

You can temporarily modify `src/lib/api.ts`:
```typescript
const API_URL = 'http://192.168.1.100:5000'; // Replace with your IP
```

## Step 4: Start the Servers

### Terminal 1 - Backend:
```bash
cd c:\krewv1\spov1
python app.py
```
The backend should be running on `http://0.0.0.0:5000` (accessible from network)

### Terminal 2 - Frontend:
```bash
cd c:\krewv1\frontend-friend
npm run dev
```
The frontend should be running on `http://0.0.0.0:8080` (accessible from network)

## Step 5: Access from Your Phone

1. Make sure your phone is on the **same WiFi network** as your computer
2. Open your phone's browser
3. Navigate to: `http://YOUR_IP_ADDRESS:8080`
   - Example: `http://192.168.1.100:8080`

## Troubleshooting

### Can't connect from phone?
- ✅ Check firewall: Windows Firewall might be blocking ports 5000 and 8080
- ✅ Verify same WiFi: Phone and computer must be on same network
- ✅ Check IP address: Make sure you're using the correct IP (not 127.0.0.1)
- ✅ Verify servers are running: Check both terminal windows

### Firewall Fix (Windows):
1. Open Windows Defender Firewall
2. Click "Advanced settings"
3. Click "Inbound Rules" → "New Rule"
4. Select "Port" → Next
5. Select "TCP" and enter ports: `5000,8080`
6. Allow the connection
7. Apply to all profiles

### Quick Test:
From your phone's browser, try accessing:
- Backend: `http://YOUR_IP:5000/songs` (should return JSON)
- Frontend: `http://YOUR_IP:8080` (should show the app)

## Notes

- The backend CORS is configured to allow requests from your local network
- Both servers must be running simultaneously
- Use your computer's local IP, not `localhost` or `127.0.0.1`
- HTTPS won't work on local network without certificates (HTTP is fine for testing)
