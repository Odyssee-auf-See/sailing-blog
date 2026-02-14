# 🚀 Quick Start Guide - AIS Map Component

## 30-Second Setup

### 1. Install Prerequisites
- **Node.js**: https://nodejs.org/ (download LTS)
- **Python**: https://www.python.org/ (any recent version)

### 2. Update Your Boat Info

Edit `new_blog/server/ais-proxy.js` (lines 11-15):
```javascript
const AIS_CONFIG = {
  mmsi: '9362786',  // ← Your boat's MMSI
  apiKey: '9258446cc328cd91f09fa81fd6e1b020fb113a28',  // ← Your API key
};
```

Get these from:
- **MMSI**: Search your boat on https://www.marinetraffic.com
- **API Key**: https://aisstream.io (your account dashboard)

### 3. Start the Servers

**Option A (Easiest - Windows):**
```powershell
cd d:\projekt\sailing-blog\new_blog
.\start-all.bat
```

**Option B (Mac/Linux or Manual - Windows):**

Terminal 1 (AIS Proxy):
```powershell
cd d:\projekt\sailing-blog\new_blog\server
npm install
npm start
```

Terminal 2 (Web Server):
```powershell
cd d:\projekt\sailing-blog\new_blog
python -m http.server 8000
```

### 4. Open in Browser

Open: **http://localhost:8000**

Scroll to the "Our Current Position" section to see the map!

## What Should You See?

✅ Map with satellite imagery  
✅ Red marker (⛵) showing your boat position  
✅ Blue track line showing your path  
✅ Info boxes updating with coordinates, time, etc.  
✅ Browser console shows: `[MAP] 🟢 Connected to AIS proxy`

## Troubleshooting

### Map not showing position?
- Check browser console (F12) for errors
- Verify your boat's MMSI is correct (search MarineTraffic)
- Verify your aisstream.io API key is valid
- Make sure your boat is transmitting AIS

### "Port already in use" or "Cannot start servers"?
- See `server/README.md` for detailed troubleshooting
- Make sure no other process is using ports 3001 or 8000

### Still stuck?
Check the detailed guide: `server/README.md`

---

## Architecture

```
Browser (localhost:8000)
    ↓ (WebSocket)
Local Proxy Server (localhost:3001, Node.js)
    ↓ (WebSocket)
aisstream.io (live AIS data)
```

The proxy server **bypasses CORS restrictions** by relaying aisstream.io's WebSocket connection to your frontend.

## Files You May Need to Edit

- `server/ais-proxy.js` — Update MMSI and API key here
- `js/map.js` — Frontend map code (already configured to use proxy)
- `components/map/map.html` — HTML structure (no changes needed)
- `css/styles.css` — Map styling (no changes needed)

## Next Steps

1. Get your boat's MMSI from MarineTraffic
2. Get your aisstream.io API key
3. Update `server/ais-proxy.js`
4. Run `start-all.bat`
5. Open http://localhost:8000
6. Check the browser console for status

---

For more details, see: **server/README.md**
