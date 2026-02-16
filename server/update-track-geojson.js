#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

// Configuration
const AISSTREAM_API_KEY = process.env.AISSTREAM_API_KEY;
const MMSI_RAW = process.env.AIS_MMSI;
const MMSI = MMSI_RAW == null ? '' : String(MMSI_RAW).replace(/^"+|"+$/g, '');
const MARINESIA_API_KEY_RAW = process.env.MARINESIA_API_KEY;
const MARINESIA_API_KEY = MARINESIA_API_KEY_RAW == null ? '' : String(MARINESIA_API_KEY_RAW).trim().replace(/^"+|"+$/g, '');
const MARINESIA_USE_DUMMY = String(process.env.MARINESIA_USE_DUMMY || '').toLowerCase() === 'true';
const TRACK_FILE = path.join(__dirname, '../data/track.geojson');
const ATON_FILE = path.join(__dirname, '../data/aton.geojson');

const MIN_DISTANCE_METERS = 100;
const ATON_TIMEOUT_MS = 30000;
const ATON_BOUNDING_BOX_DEGREES = 1;

if (!MMSI) {
  console.error('Error: AIS_MMSI must be set');
  process.exit(1);
}

if (!AISSTREAM_API_KEY && !MARINESIA_API_KEY) {
  console.error('Error: AISSTREAM_API_KEY or MARINESIA_API_KEY must be set');
  process.exit(1);
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

const MARINESIA_DUMMY_RESPONSE = {
  error: false,
  message: 'Successfully fetched data',
  data: {
    mmsi: 265510570,
    com_state: 67761,
    status: 4,
    pos_acc: true,
    raim: false,
    lat: 59.288612,
    lng: 18.915412,
    cog: 167.1,
    sog: 0,
    rot: 0,
    spare: 0,
    hdt: 194,
    repeat: 0,
    smi: 0,
    valid: true,
    ts: '2025-07-20T00:00:13.731652',
  },
};

async function fetchVesselPositionFromMarinesia() {
  if (!MARINESIA_API_KEY && !MARINESIA_USE_DUMMY) {
    throw new Error('Marinesia API key is missing');
  }

  let data;

  if (MARINESIA_USE_DUMMY) {
    console.log('[MARINESIA] Using dummy response (MARINESIA_USE_DUMMY=true)');
    data = MARINESIA_DUMMY_RESPONSE;
  } else {
    const url = `https://api.marinesia.com/api/v1/vessel/${encodeURIComponent(MMSI)}/location/latest?key=${encodeURIComponent(MARINESIA_API_KEY)}`;
    console.log(`[MARINESIA] Requesting latest location for MMSI ${MMSI}`);
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'sailing-blog-updater/1.0',
      },
    });
    console.log(`[MARINESIA] Response status: ${resp.status} ${resp.statusText}`);
    if (!resp.ok) {
      throw new Error(`Marinesia request failed: ${resp.status} ${resp.statusText}`);
    }

    data = await resp.json();
  }
  const payload = data?.data ?? data;
  const lat = toNumber(payload?.latitude ?? payload?.lat ?? payload?.location?.lat ?? payload?.location?.latitude);
  const lon = toNumber(payload?.longitude ?? payload?.lon ?? payload?.lng ?? payload?.location?.lon ?? payload?.location?.longitude);

  console.log(`[MARINESIA] Parsed position: lat=${lat}, lon=${lon}`);

  if (lat == null || lon == null) {
    throw new Error('Marinesia response missing latitude/longitude');
  }

  return {
    Latitude: lat,
    Longitude: lon,
    SOG: toNumber(payload?.sog ?? payload?.speed ?? payload?.speedOverGround ?? payload?.location?.sog) || 0,
    COG: toNumber(payload?.cog ?? payload?.course ?? payload?.courseOverGround ?? payload?.location?.cog) || 0,
    ShipName: payload?.vesselName ?? payload?.name ?? payload?.vessel?.name ?? 'Vessel',
    Timestamp: payload?.timestamp ?? payload?.time ?? payload?.ts ?? payload?.location?.timestamp ?? new Date().toISOString(),
  };
}

async function fetchVesselPositionFromAISStream() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

    // Timeout after 1min if no signal is found
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error('Timeout: No AIS position received for this MMSI. The boat might be offline.'));
    }, 60000);

    socket.on('open', () => {
      console.log('🌐 Connected to AISStream. Sending subscription...');
      const subscription = {
        APIKey: AISSTREAM_API_KEY,
        BoundingBoxes: [[[-90, -180], [90, 180]]],
        FiltersShipMMSI: [MMSI],
        FilterMessageTypes: ["PositionReport"]
      };
      socket.send(JSON.stringify(subscription));
    });

    socket.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch (err) {
        console.error('[UPDATER] Failed to parse AISStream message:', err.message);
        console.error('[UPDATER] Raw message:', data.toString());
        return;
      }
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

function loadAtonFile() {
  try {
    if (!fs.existsSync(ATON_FILE)) return { type: 'FeatureCollection', features: [] };
    const raw = fs.readFileSync(ATON_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[UPDATER] Failed to read AtoN file:', err.message);
    return { type: 'FeatureCollection', features: [] };
  }
}

function saveAtonFile(geojson) {
  try {
    fs.writeFileSync(ATON_FILE, JSON.stringify(geojson, null, 2), 'utf8');
    console.log(`[UPDATER] AtoN data written to ${ATON_FILE} (${geojson.features.length} points)`);
  } catch (err) {
    console.error('[UPDATER] Failed to write AtoN file:', err.message);
  }
}

async function fetchAidsToNavigationReports(centerLat, centerLon) {
  if (!AISSTREAM_API_KEY) {
    console.warn('[UPDATER] AISSTREAM_API_KEY not set; skipping AtoN fetch.');
    return [];
  }

  return new Promise((resolve) => {
    const socket = new WebSocket('wss://stream.aisstream.io/v0/stream');
    const features = [];

    const timer = setTimeout(() => {
      socket.terminate();
      resolve(features);
    }, ATON_TIMEOUT_MS);

    socket.on('open', () => {
      const delta = ATON_BOUNDING_BOX_DEGREES;
      console.log([centerLat - delta, centerLon - delta], [centerLat + delta, centerLon + delta]);
      const subscription = {
        APIKey: AISSTREAM_API_KEY,
        BoundingBoxes: [[[centerLat - delta, centerLon - delta], [centerLat + delta, centerLon + delta]]],
        FilterMessageTypes: ['AidsToNavigationReport'],
      };
      socket.send(JSON.stringify(subscription));
    });
    

    socket.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data);
      } catch (err) {
        return;
      }

      if (msg.MessageType !== 'AidsToNavigationReport') return;

      const report = msg.Message?.AidsToNavigationReport || msg.Message || {};
      const lat = toNumber(report.Latitude ?? report.latitude ?? report.lat);
      const lon = toNumber(report.Longitude ?? report.longitude ?? report.lon);

      if (lat == null || lon == null) return;

      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon, lat] },
        properties: {
          timestamp: report.Timestamp ?? new Date().toISOString(),
          name: report.Name ?? report.NameOfAtoN ?? 'AtoN',
          nameExtension: report.NameExtension ?? null,
          mmsi: report.MMSI ?? report.MMSINumber ?? report.UserID ?? null,
          type: report.AtoNType ?? report.Type ?? report.AtoN ?? null,
          aton: report.AtoN ?? null,
          virtual: report.VirtualAtoN ?? null,
          offPosition: report.OffPosition ?? null,
          positionAccuracy: report.PositionAccuracy ?? null,
          raim: report.Raim ?? null,
          fixType: report.Fixtype ?? null,
          assignedMode: report.AssignedMode ?? null,
          valid: report.Valid ?? null,
          dimension: report.Dimension ?? null,
        },
      });
    });

    socket.on('error', () => {
      clearTimeout(timer);
      resolve(features);
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

    if (distance < MIN_DISTANCE_METERS) {
      console.log('[UPDATER] Sampled point too close in distance; skipping append.');
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
    console.log('[UPDATER] Fetching vessel position...');
    const vessel = MARINESIA_API_KEY
      ? await fetchVesselPositionFromMarinesia()
      : await fetchVesselPositionFromAISStream();
    const lat = vessel.Latitude;
    const lon = vessel.Longitude;
    const sog = vessel.SOG;
    const cog = vessel.COG;
    const timestamp = vessel.Timestamp || new Date().toISOString();

    console.log(`✅ Received: ${vessel.ShipName} at ${lat}, ${lon}`);

    console.log('[UPDATER] Loading track file...');
    const track = loadTrackFile();
    console.log('[UPDATER] Adding position to track...');
    const added = addPositionToTrack(track, lat, lon, sog, cog, timestamp);

    if (added) {
      console.log('[UPDATER] Saving track file...');
      saveTrackFile(track);
      console.log('✅ Track updated.');
    } else {
      console.log('[UPDATER] Track not updated (distance threshold).');
    }

    console.log('[UPDATER] Fetching AtoN data from AISStream...');
    const atonFeatures = await fetchAidsToNavigationReports(lat, lon);
    if (atonFeatures.length > 0) {
      console.log(`[UPDATER] Writing ${atonFeatures.length} AtoN points...`);
      const atonGeo = loadAtonFile();
      atonGeo.features = atonFeatures;
      saveAtonFile(atonGeo);
    } else {
      console.log('[UPDATER] No AtoN data received.');
    }
  } catch (error) {
    console.error(`\n❌ ${error.message}\n`);
    // Exit gracefully so GitHub Actions doesn't mark it as a "Failure" if the boat is just offline
    process.exit(0); 
  }
}

// (Remember to include your helper functions from the original script here!)
main();
