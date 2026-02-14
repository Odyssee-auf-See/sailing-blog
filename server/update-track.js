/**
 * update-track.js
 *
 * Simple Node.js script to fetch the latest AIS PositionReport for a single MMSI
 * from aisstream.io (WebSocket) and append it to ../data/track.geojson.
 *
 * Usage (locally):
 *   set MMSI=9362786
 *   set API_KEY=your_api_key_here
 *   node update-track.js
 *
 * The script will wait up to `MESSAGE_TIMEOUT_MS` milliseconds for a matching message.
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const MMSI = process.env.MMSI || '9362786';
const API_KEY = process.env.API_KEY || '';
const MESSAGE_TIMEOUT_MS = 20000; // 20s
const TRACK_PATH = path.resolve(__dirname, '..', 'data', 'track.geojson');

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function loadTrack() {
  try {
    if (!fs.existsSync(TRACK_PATH)) return { type: 'FeatureCollection', features: [] };
    const raw = fs.readFileSync(TRACK_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[UPDATER] Failed to read track file:', err.message);
    return { type: 'FeatureCollection', features: [] };
  }
}

function saveTrack(track) {
  try {
    fs.writeFileSync(TRACK_PATH, JSON.stringify(track, null, 2), 'utf8');
    console.log(`[UPDATER] Track written to ${TRACK_PATH} (${track.features.length} points)`);
  } catch (err) {
    console.error('[UPDATER] Failed to write track file:', err.message);
  }
}

function appendPointToTrack(point) {
  const track = loadTrack();

  // sampling: check last point
  const last = track.features.length > 0 ? track.features[track.features.length - 1] : null;
  if (last) {
    const [lastLon, lastLat] = last.geometry.coordinates;
    const timeDelta = (new Date(point.timestamp) - new Date(last.properties.timestamp)) / 1000;
    const distance = haversineDistance(lastLat, lastLon, point.lat, point.lon);

    if (timeDelta < 30 && distance < 100) {
      console.log('[UPDATER] Sampled point too close in time/distance; skipping append.');
      return false;
    }
  }

  const feature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [point.lon, point.lat] },
    properties: { timestamp: point.timestamp, sog: point.sog || 0, cog: point.cog || 0 },
  };

  track.features.push(feature);
  saveTrack(track);
  return true;
}

// Connect to aisstream.io and wait for a PositionReport for our MMSI
async function runUpdater() {
  if (!API_KEY) {
    console.warn('[UPDATER] No API_KEY set in environment; please set API_KEY to your aisstream.io key.');
  }

  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

  let timer = null;
  let done = false;

  ws.on('open', () => {
    console.log('[UPDATER] Connected to aisstream.io');

    // subscription message mirrors proxy format
    const subscriptionMessage = {
      Apikey: API_KEY,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FiltersShipMMSI: [MMSI],
      FilterMessageTypes: ['PositionReport'],
    };

    ws.send(JSON.stringify(subscriptionMessage));
    console.log(`[UPDATER] Subscription sent for MMSI=${MMSI}`);

    timer = setTimeout(() => {
      if (!done) {
        console.error('[UPDATER] Timeout waiting for AIS message. Exiting.');
        ws.terminate();
        process.exit(2);
      }
    }, MESSAGE_TIMEOUT_MS);
  });

  ws.on('message', (data) => {
    if (done) return;
    try {
      const msg = JSON.parse(data);

      // Message may be wrapped (e.g. { Message: { Latitude, Longitude, MMSI, ... } })
      const payload = msg.Message || msg;

      const mmsiVal = payload.MMSI || payload.mmsi || payload.MMSINumber || null;
      const lat = payload.Latitude || payload.latitude || null;
      const lon = payload.Longitude || payload.longitude || null;

      if (!mmsiVal || !lat || !lon) {
        console.log('[UPDATER] Received non-position message or missing fields; ignoring');
        return;
      }

      if (String(mmsiVal) !== String(MMSI)) {
        console.log('[UPDATER] Received message for other MMSI, ignoring');
        return;
      }

      const point = {
        lat: Number(lat),
        lon: Number(lon),
        sog: payload.SOG || payload.sog || 0,
        cog: payload.COG || payload.cog || 0,
        timestamp: payload.Timestamp || payload.timestamp || new Date().toISOString(),
      };

      console.log('[UPDATER] Received position for MMSI', MMSI, point);

      const appended = appendPointToTrack(point);
      done = true;
      clearTimeout(timer);
      ws.close();
      process.exit(appended ? 0 : 0);
    } catch (err) {
      console.error('[UPDATER] Error parsing AIS message:', err.message);
    }
  });

  ws.on('error', (err) => {
    console.error('[UPDATER] WebSocket error:', err.message);
    if (!done) process.exit(3);
  });

  ws.on('close', () => {
    if (!done) {
      console.warn('[UPDATER] WebSocket closed before receiving data');
      process.exit(4);
    }
  });
}

runUpdater();
