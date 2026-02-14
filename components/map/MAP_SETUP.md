# Map Component Setup Guide

## Overview
This map component displays your boat's real-time position from AIS data on a satellite map (Leaflet + Esri tiles), shows 4 dynamic info boxes, and records the track as GeoJSON in localStorage.

The component uses a **WebSocket connection** to aisstream.io for live streaming AIS data, ensuring you get continuous updates without polling delays.

## Quick Start

### 1. Get Your Boat's MMSI
Your boat has a unique **MMSI** (Maritime Mobile Service Identity) number. You'll need this to fetch the correct vessel data.

If you don't know your MMSI:
- Check your boat registration documents
- Search online at [MarineTraffic](https://www.marinetraffic.com) using your boat's name or call sign
- Example MMSI format: 219xxxxx, 230xxxxx, 238xxxxx, etc.

### 2. Get aisstream.io API Key

1. Visit [aisstream.io](https://aisstream.io)
2. Create a free account and register
3. Get your **API key** from your account dashboard
4. Note your boat's **MMSI**

### 3. Update Configuration in `js/map.js`

Edit the `MAP_CONFIG` object at the top of `js/map.js` (lines 6-16):

```javascript
const MAP_CONFIG = {
  mmsi: 238317140,                      // Replace with your actual boat MMSI
  apiKey: 'YOUR_AISSTREAM_API_KEY',    // Replace with your aisstream.io API key
  useTestData: false,                   // Set to true to test with sample-ais.json
  testDataPollInterval: 5000,            // milliseconds between test data updates
  sampleThresholdTime: 30,              // seconds between persisted track points
  sampleThresholdDistance: 100,         // meters minimum distance between points
  center: [60.1699, 24.9384],           // Default map center (Oslo area)
  zoom: 8,
};
```

## Testing & Development

### Test Without API Key (Recommended First Step)

To test the map component without a real API, use the built-in test mode:

1. In `js/map.js`, change `useTestData: false` to `useTestData: true`
2. Start your local server: `python -m http.server 8000` from `new_blog` folder
3. Open http://localhost:8000
4. The map will load with sample data from `data/sample-ais.json`
5. Info boxes and track will update every 5 seconds

This is perfect for:
- Testing the UI without an API key
- Verifying the track recording works
- Checking localStorage persistence
- Developing locally before connecting to live data

### Switch to Live AIS

Once you have your MMSI and aisstream.io API key:

1. Update `MAP_CONFIG.mmsi` and `MAP_CONFIG.apiKey` in `js/map.js`
2. Change `useTestData: false` (or remove the line since false is default)
3. Ensure your boat is transmitting AIS (usually happens when the boat is underway)
4. Open the browser console (F12) to see connection status
5. Watch for messages like:
   - `[MAP] WebSocket connected to aisstream.io`
   - `[MAP] Subscription message sent for MMSI: 238317140`
   - `[MAP] Received AIS message: {...}`

## How It Works

### WebSocket Connection
The component uses a persistent WebSocket connection to aisstream.io instead of HTTP polling:
- **Pros**: Real-time updates, lower latency, more efficient
- **Connection**: Established in `connectToAISStream()` function
- **Subscription**: Filters data to your boat's MMSI automatically
- **Auto-reconnect**: If connection drops, attempts to reconnect with exponential backoff (up to 5 attempts)

### Info Boxes (Top Section)
- **📍 Coordinates**: Current latitude/longitude in degrees, minutes, seconds format (e.g., 60°10'11"N)
- **💨 Wind Strength**: Placeholder (would need separate weather API integration)
- **🌊 Distance Sailed**: Count of track points recorded (rough estimate)
- **⏰ Local Time**: Current local time, updated with each AIS message

### Map Features
- **Satellite Imagery**: Esri.WorldImagery high-resolution tiles
- **Current Position Marker**: Red circle with boat emoji (⛵), rotates to show course heading
- **Track Line**: Blue polyline showing the complete sailed route (loaded from localStorage on page load)

### Data Storage
- **Format**: GeoJSON FeatureCollection (standard geospatial format)
- **Storage**: Browser's localStorage
- **Key**: `boat_track_geojson`
- **Persistence**: Track data survives page reloads
- **Sampling**: Only keeps points that meet thresholds:
  - Minimum 30 seconds apart, OR
  - Minimum 100 meters distance, OR
  - Speed/heading change threshold

### Export Track Data

To save and analyze your track:

```javascript
// In browser console (F12):
exportTrackAsGeoJSON();
```

This downloads a file like `boat_track_2026-02-08.geojson` that can be opened in:
- **QGIS** — for detailed geographic analysis
- **PostGIS** — for server-side storage and querying
- **Mapbox** — for web-based visualization
- **Google Earth** — for 3D viewing
- Any other GIS tool that supports GeoJSON

**GeoJSON Sample Structure:**
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [24.9384, 60.1699]
      },
      "properties": {
        "timestamp": "2026-02-08T12:00:00Z",
        "sog": 8.5,
        "cog": 215
      }
    }
  ]
}
```

## Troubleshooting

### Map not appearing
- **Check**: Browser console (F12) for errors
- **Check**: Network tab for Leaflet CDN requests returning 200 status
- **Check**: `map-container` div has rendered (inspect element in DevTools)

### WebSocket connection not established
- **Check**: Browser console shows `[MAP] WebSocket connected...`
- **Verify**: Your aisstream.io API key is correct in `MAP_CONFIG`
- **Verify**: Your boat's MMSI is correct
- **Verify**: Your boat is AIS-equipped and transmitting (underway with AIS on)
- **Try test mode**: Set `useTestData: true` to verify the UI works

### No AIS markers appearing
- **Check**: Browser console for `[MAP] Received AIS message:` log entries
- **If missing**: Your boat may not be broadcasting, or MMSI is incorrect
- **Try different MMSI**: Search [MarineTraffic](https://www.marinetraffic.com) for your boat name
- **Check aisstream.io**: Visit their dashboard to verify boat visibility in their system

### localStorage quota exceeded
- **Fix**: Clear old data in DevTools:
  - F12 → Application → Local Storage → Right-click `boat_track_geojson` → Delete
  - Or press F12, then in console: `localStorage.clear()`
- **Reduce frequency**: Increase `sampleThresholdTime` (e.g., 60 instead of 30) or `sampleThresholdDistance`
- **Archive data**: Export track as GeoJSON regularly to free up space

### Marker not rotating correctly
- **Info**: Rotation is based on COG (Course Over Ground) from AIS data
- **Note**: Some vessels report COG as 0° when moving slowly or stationary
- **Check**: Marker should show correct heading when boat is moving steadily

## Browser Compatibility
- ✅ Chrome/Chromium (all versions)
- ✅ Firefox (all versions)
- ✅ Safari (iOS 14+, macOS 10.15+)
- ✅ Edge (all versions)
- ❌ IE11 (no WebSocket or async/await support)

## Performance Notes
- **Leaflet size**: ~40KB gzipped
- **Tile loading**: Esri tiles load on-demand; zoom/pan may lag briefly
- **Track rendering**: <1000 points is smooth; 1000-5000 may show slight lag
- **For large datasets**: Consider using IndexedDB or exporting to PostGIS

## Advanced Options

### Use IndexedDB for larger datasets
Replace localStorage with IndexedDB to support 500K+ track points:
- IndexedDB is asynchronous and can handle much larger volumes
- See `persistTrackGeoJSON()` function in `js/map.js` for modification points

### Server-side track storage
For production use, add a backend:
1. Add an endpoint (e.g., `/api/track/save`) to your server
2. Modify `persistTrackGeoJSON()` to POST data to your server instead of localStorage
3. Use PostGIS (PostgreSQL extension) for powerful spatial queries

### Custom weather/wind data
The "Wind Strength" box currently shows "--". To integrate real wind data:
1. Use OpenWeatherMap, NOAA, or similar weather API
2. Fetch wind speed/direction at your boat's GPS coordinates
3. Update the "Wind Strength" box in `updateInfoBoxes()` function

## API Reference

### `MAP_CONFIG` Object
```javascript
{
  mmsi: string,                    // Your boat's MMSI number
  apiKey: string,                  // aisstream.io API key
  useTestData: boolean,            // Enable test mode with sample data
  testDataPollInterval: number,   // Milliseconds between test updates
  sampleThresholdTime: number,     // Seconds between persisted points
  sampleThresholdDistance: number, // Meters between persisted points
  center: [lat, lon],              // Default map center coordinates
  zoom: number,                    // Default zoom level
}
```

### Functions (exposed globally)
- `initMap(containerId, options)` — Initialize the map (called automatically by loadHTML)
- `connectToAISStream()` — Establish WebSocket connection
- `disconnectAISStream()` — Close WebSocket connection
- `exportTrackAsGeoJSON()` — Download track as GeoJSON file
- `startTestDataPolling()` — Start polling sample-ais.json (test mode)

### Events (logged to console)
- `[MAP] WebSocket connected` — Connection established
- `[MAP] Received AIS message` — New position update
- `[MAP] Track persisted` — Point saved to localStorage
- `[MAP] WebSocket disconnected` — Connection closed (auto-reconnect starts)

## Next Steps

1. ✅ Verify you have your boat's MMSI
2. ✅ Get an aisstream.io API key
3. ✅ Update `MAP_CONFIG` in `js/map.js`
4. 🧪 **Test with `useTestData: true` first** (recommended!)
5. ✅ Switch to live data when confident
6. 📍 Monitor browser console (F12) for connection status
7. 💾 Periodically export your track with `exportTrackAsGeoJSON()`

---

**Questions?** Refer to:
- [Leaflet Documentation](https://leafletjs.com)
- [aisstream.io API Docs](https://aisstream.io/api) (WebSocket details)
- [GeoJSON Specification](https://geojson.org)
- [QGIS for track analysis](https://www.qgis.org)

