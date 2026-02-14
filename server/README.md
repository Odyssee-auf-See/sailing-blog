# AIS Proxy Server Setup

## Overview

The **AIS Proxy Server** is a Node.js application that:
- Connects to aisstream.io via WebSocket and receives live AIS data
- Relays position updates to your frontend website
- Handles connection management and auto-reconnection
- Runs on your local machine (or server) to bypass browser CORS restrictions

## Why Do You Need This?

Browsers cannot directly connect to aisstream.io's WebSocket due to:
1. **CORS restrictions** — same-origin policy prevents direct WebSocket connections
2. **Mixed content issues** — HTTP site cannot connect to secure WebSocket (WSS)

The proxy server runs on your machine and acts as a relay, allowing your browser to connect securely via a local WebSocket.

## Prerequisites

### 1. Node.js Installation

Download and install Node.js (includes npm):
- Visit: https://nodejs.org/ 
- Download: **LTS (Long-Term Support)** version recommended
- Install with default settings
- Verify installation:
  ```powershell
  node --version
  npm --version
  ```

### 2. Python Installation (for Web Server)

Download and install Python:
- Visit: https://www.python.org/
- Download: Python 3.9 or later
- **Important**: Check "Add Python to PATH" during installation
- Verify installation:
  ```powershell
  python --version
  ```

### 3. aisstream.io Account & API Key

1. Go to https://aisstream.io
2. Create/sign in to your account
3. Get your **API key** from the dashboard
4. Find your boat's **MMSI** number

## Quick Start (Recommended)

### Option A: One-Command Startup

The easiest way — runs both servers automatically:

```powershell
cd d:\projekt\sailing-blog\new_blog
.\start-all.bat
```

This opens two terminal windows:
- **AIS Proxy Server** — listening on `ws://localhost:3001`
- **Web Server** — serving http://localhost:8000

Then open your browser to: **http://localhost:8000**

---

### Option B: Manual Startup (Two Terminals)

If the one-button startup doesn't work, you can start each server manually.

**Terminal 1 (AIS Proxy Server):**
```powershell
cd d:\projekt\sailing-blog\new_blog\server
npm install
npm start
```

**Terminal 2 (Web Server):**
```powershell
cd d:\projekt\sailing-blog\new_blog
python -m http.server 8000
```

Then open: **http://localhost:8000**

## Configuration

Before starting, update your credentials in the proxy server config:

**File:** `new_blog/server/ais-proxy.js` (lines 11-15)

```javascript
const AIS_CONFIG = {
  mmsi: '9362786',  // ← Replace with YOUR boat MMSI
  apiKey: '9258446cc328cd91f09fa81fd6e1b020fb113a28',  // ← Replace with YOUR aisstream.io API key
};
```

**How to find your MMSI:**
1. Log into https://www.marinetraffic.com
2. Search for your boat name or call sign
3. The MMSI is shown in the vessel details

**How to find your aisstream.io API key:**
1. Log into https://aisstream.io
2. Go to your account dashboard
3. Copy your API key

## Verify It's Working

### Check Proxy Server Status

Open in your browser:
```
http://localhost:3001/health
```

You should see JSON like:
```json
{
  "status": "running",
  "connectedToAIS": true,
  "frontendClients": 1
}
```

### Check Browser Console

1. Open http://localhost:8000
2. Press **F12** to open DevTools
3. Go to **Console** tab
4. Look for messages like:
   - `[MAP] 🟢 Connected to AIS proxy`
   - `[MAP] Received AIS position update via proxy`

### Check Map Display

Scroll to the map section (below blog):
- Map should load with satellite imagery
- Position marker (⛵) should appear
- Info boxes should show coordinates, time, etc.
- Track line should build up over time

## Troubleshooting

### "Command 'node' not found" or "npm is not recognized"

**Solution:** Node.js is not properly installed or not in PATH
1. Reinstall Node.js from https://nodejs.org/
2. Make sure to check "Add to PATH" during installation
3. Restart your PowerShell/CMD window after installation
4. Verify: `node --version`

### Proxy won't start / "Cannot find module 'ws'"

**Solution:** NPM dependencies not installed
```powershell
cd d:\projekt\sailing-blog\new_blog\server
npm install
```

### "EADDRINUSE: address already in use :::3001"

**Solution:** Port 3001 is already in use
- Another instance of the proxy is running
- Kill it by closing the terminal, or change the port in `ais-proxy.js` line 16

### Map shows but no position updates

**Possible causes:**
1. **Wrong MMSI** — verify your boat's MMSI is correct
2. **Wrong API key** — double-check your aisstream.io API key
3. **Boat not transmitting** — some boats only broadcast while underway
4. **Proxy not connected** — check browser console for errors
5. **Firewalls** — ensure port 3001 isn't blocked

**Debug steps:**
1. Check browser console (F12) for errors
2. Check proxy terminal output for connection status
3. Verify proxy health: http://localhost:3001/health
4. Check aisstream.io dashboard to confirm your boat is visible

### "WebSocket connection to 'ws://localhost:3001' failed"

**Possible causes:**
1. **Proxy server not running** — make sure the proxy terminal is open and running
2. **Wrong proxy URL** — verify `new_blog/js/map.js` line ~10 has correct URL
3. **Port in use** — change port 3001 if another app uses it

### Boat not showing on map

**Possible causes:**
1. **Boat is not broadcasting AIS** — AIS is usually on when underway
2. **Wrong MMSI** — search https://www.marinetraffic.com to find your boat's correct MMSI
3. **API quota** — aisstream.io demo accounts have limited messages/day
4. **Subscription filter** — check proxy is filtering for your MMSI correctly

**Debug: Check what the proxy is receiving**
In the proxy terminal output, look for:
```
[PROXY] Received AIS message from aisstream.io...
```

If you see this, aisstream.io is sending data. If not, check your MMSI and API key.

### Browser shows "No Track Data" or empty map

This could be normal on first startup if the boat hasn't sent an update yet.
- The map updates every time the boat broadcasts AIS (usually every 10-30 seconds)
- If the boat is not moving or AIS is off, no updates arrive
- Check the info box status: should show 🟢 "Connected"

## File Structure

```
new_blog/
├── server/
│   ├── ais-proxy.js          ← Main proxy server code
│   ├── package.json          ← Node.js dependencies
│   ├── start-proxy.bat       ← Windows launcher for proxy
│   └── start-proxy.ps1       ← PowerShell launcher for proxy
├── start-all.bat             ← Launches both servers at once
├── js/
│   └── map.js                ← Frontend map code (connects to proxy)
└── ...
```

## Next Steps

1. ✅ Install Node.js and Python
2. ✅ Get your boat's MMSI and aisstream.io API key
3. ✅ Update credentials in `new_blog/server/ais-proxy.js`
4. ✅ Run `start-all.bat` (or run both servers manually)
5. ✅ Open http://localhost:8000
6. ✅ Check browser console (F12) for connection status
7. ✅ Watch the map update with your boat's position

## Advanced Options

### Change Proxy Port

If port 3001 is in use, you can change it in:
- `new_blog/server/ais-proxy.js` line 16: `const PORT = 3001;`
- `new_blog/js/map.js` line ~110: change `ws://localhost:3001` to your new port

### Run on a Server

To run this on a VPS or cloud server:
1. Copy the `new_blog/server/` folder to your server
2. Install Node.js on the server
3. Update `ais-proxy.js` with your credentials
4. Start the proxy: `npm start`
5. Update frontend URL in `map.js` to point to your server IP
6. Frontend connects to `ws://your-server-ip:3001`

### Monitor in Production

The proxy logs all connections and errors to the terminal. For production, consider:
- Redirecting logs to a file: `npm start > ais-proxy.log 2>&1 &`
- Using a process manager like `pm2`: `npm install -g pm2`
- Running behind a reverse proxy (nginx) for security

## Support

If you encounter issues:
1. Check the browser console (F12) for error messages
2. Check the proxy terminal output for connection logs
3. Verify your MMSI matches your boat on https://www.marinetraffic.com
4. Verify your aisstream.io API key is valid and active
5. Ensure your firewall allows connections on ports 3001 and 8000

---

**Happy sailing!** ⛵
