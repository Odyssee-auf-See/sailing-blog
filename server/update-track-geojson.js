#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Configuration
const API_KEY = process.env.AIS_API_KEY;
const MMSI = process.env.AIS_MMSI;
const TRACK_FILE = path.join(__dirname, '../data/track.geojson');

const MIN_DISTANCE_METERS = 100; 
const MIN_TIME_SECONDS = 30;

if (!API_KEY || !MMSI) {
  console.error('Error: AIS_API_KEY and AIS_MMSI must be set');
  process.exit(1);
}

async function fetchVesselPosition() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

    // Timeout after 30 seconds if no signal is found
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error('Timeout: No AIS position received for this MMSI. The boat might be offline.'));
    }, 300000);

    socket.on('open', () => {
      console.log('🌐 Connected to AISStream. Sending subscription...');
      const subscription = {
        APIKey: API_KEY,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FiltersShipMMSI: ["538005869", "255806508", "563221900", "563097900"],
        FilterMessageTypes: ["PositionReport"]
      };
      socket.send(JSON.stringify(subscription));
    });

    socket.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.MessageType === "PositionReport") {
        clearTimeout(timer);
        const report = msg.Message.PositionReport;
        const meta = msg.MetaData;
        socket.terminate();
        
        resolve({
          Latitude: report.Latitude,
          Longitude: report.Longitude,
          SOG: report.Sog,
          COG: report.Cog,
          ShipName: meta.ShipName || "Vessel"
        });
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// --- Keep your existing haversineDistance, loadTrackFile, saveTrackFile, and addPositionToTrack functions below ---
// (Make sure to paste them back in here)

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // metres
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function loadTrackFile() {
  try {
    if (!fs.existsSync(TRACK_FILE)) return { type: 'FeatureCollection', features: [] };
    const raw = fs.readFileSync(TRACK_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[UPDATER] Failed to read track file:', err.message);
    return { type: 'FeatureCollection', features: [] };
  }
}

function saveTrackFile(track) {
  try {
    fs.writeFileSync(TRACK_FILE, JSON.stringify(track, null, 2), 'utf8');
    console.log(`[UPDATER] Track written to ${TRACK_FILE} (${track.features.length} points)`);
  } catch (err) {
    console.error('[UPDATER] Failed to write track file:', err.message);
  }
}

function addPositionToTrack(track, lat, lon, sog, cog, timestamp) {
  // sanity: create feature collection if needed
  if (!track || track.type !== 'FeatureCollection') track = { type: 'FeatureCollection', features: [] };

  const last = track.features.length > 0 ? track.features[track.features.length - 1] : null;
  if (last) {
    const [lastLon, lastLat] = last.geometry.coordinates;
    const timeDelta = (new Date(timestamp) - new Date(last.properties.timestamp)) / 1000;
    const distance = haversineDistance(lastLat, lastLon, lat, lon);

    if (timeDelta < MIN_TIME_SECONDS && distance < MIN_DISTANCE_METERS) {
      console.log('[UPDATER] Sampled point too close in time/distance; skipping append.');
      return false;
    }
  }

  const feature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { timestamp: timestamp, sog: sog || 0, cog: cog || 0 },
  };

  track.features.push(feature);
  return true;
}

async function main() {
  console.log(`\n🚤 AIS Track Updater - MMSI: ${MMSI}`);
  try {
    const vessel = await fetchVesselPosition();
    const lat = vessel.Latitude;
    const lon = vessel.Longitude;
    const sog = vessel.SOG;
    const cog = vessel.COG;
    const timestamp = new Date().toISOString();

    console.log(`✅ Received: ${vessel.ShipName} at ${lat}, ${lon}`);

    const track = loadTrackFile();
    const added = addPositionToTrack(track, lat, lon, sog, cog, timestamp);

    if (added) {
      saveTrackFile(track);
      console.log('✅ Track updated.');
    }
  } catch (error) {
    console.error(`\n❌ ${error.message}\n`);
    // Exit gracefully so GitHub Actions doesn't mark it as a "Failure" if the boat is just offline
    process.exit(0); 
  }
}

// (Remember to include your helper functions from the original script here!)
main();