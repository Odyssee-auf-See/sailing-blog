#!/usr/bin/env node
/**
 * Update track.geojson from AISStream.io
 * 
 * Environment variables:
 * - AIS_API_KEY: Your AISStream API key
 * - AIS_MMSI: Your boat's MMSI number
 * 
 * Usage: node update-track-geojson.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const API_KEY = process.env.AIS_API_KEY;
const MMSI = process.env.AIS_MMSI;
const TRACK_FILE = path.join(__dirname, '../data/track.geojson');

// Thresholds for point sampling
const MIN_DISTANCE_METERS = 100; // Don't add points closer than 100m
const MIN_TIME_SECONDS = 30; // Don't add points closer than 30 seconds

if (!API_KEY || !MMSI) {
  console.error('Error: AIS_API_KEY and AIS_MMSI environment variables must be set');
  process.exit(1);
}

/**
 * Fetch vessel info from AISStream.io
 * Returns vessel AIS message data
 */
const WebSocket = require('ws');

async function fetchVesselPosition() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket("wss://stream.aisstream.io/v0/stream");

    socket.on('open', () => {
      const subscriptionMessage = {
        APIKey: API_KEY,
        FiltersShipMMSI: [MMSI], // Filter for your specific boat
        FilterMessageTypes: ["PositionReport"]
      };
      socket.send(JSON.stringify(subscriptionMessage));
    });

    socket.on('message', (data) => {
      const message = JSON.parse(data);
      if (message.MessageType === "PositionReport") {
        const report = message.Message.PositionReport;
        socket.close(); // We got what we need, close connection
        resolve({
          Latitude: report.Latitude,
          Longitude: report.Longitude,
          SOG: report.Sog,
          COG: report.Cog,
          ShipName: "My Vessel"
        });
      }
    });

    socket.on('error', (err) => reject(err));
    setTimeout(() => {
      socket.close();
      reject(new Error('Timeout: No AIS message received for this MMSI'));
    }, 15000); // Wait 15 seconds for a signal
  });
}

/**
 * Calculate haversine distance between two points in meters
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Load existing track.geojson or create a new one
 */
function loadTrackFile() {
  if (!fs.existsSync(TRACK_FILE)) {
    console.log(`Track file not found, creating new one at ${TRACK_FILE}`);
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  try {
    const content = fs.readFileSync(TRACK_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`Error reading track file: ${e.message}`);
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }
}

/**
 * Save track.geojson to disk
 */
function saveTrackFile(track) {
  try {
    fs.writeFileSync(TRACK_FILE, JSON.stringify(track, null, 2), 'utf-8');
    console.log(`Track file saved: ${TRACK_FILE}`);
    return true;
  } catch (e) {
    console.error(`Error saving track file: ${e.message}`);
    return false;
  }
}

/**
 * Add a new position point to the track if it meets sampling criteria
 */
function addPositionToTrack(track, lat, lon, sog, cog, timestamp) {
  const newFeature = {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [lon, lat],
    },
    properties: {
      timestamp,
      sog: parseFloat(sog) || 0,
      cog: parseFloat(cog) || 0,
    },
  };

  // If track is empty, add the first point
  if (!track.features || track.features.length === 0) {
    track.features = [newFeature];
    console.log(`Added first position: ${lat.toFixed(5)}, ${lon.toFixed(5)}`);
    return true;
  }

  // Check against last point
  const lastFeature = track.features[track.features.length - 1];
  const [lastLon, lastLat] = lastFeature.geometry.coordinates;
  const lastTimestamp = new Date(lastFeature.properties.timestamp);
  const newTimestamp = new Date(timestamp);

  // Check time threshold
  const timeDiff = (newTimestamp - lastTimestamp) / 1000; // in seconds
  if (timeDiff < MIN_TIME_SECONDS) {
    console.log(`⏭️  Point too recent (${timeDiff.toFixed(1)}s, need ${MIN_TIME_SECONDS}s), skipping`);
    return false;
  }

  // Check distance threshold
  const distance = haversineDistance(lastLat, lastLon, lat, lon);
  if (distance < MIN_DISTANCE_METERS) {
    console.log(`⏭️  Point too close (${distance.toFixed(1)}m, need ${MIN_DISTANCE_METERS}m), skipping`);
    return false;
  }

  // Add the new point
  track.features.push(newFeature);
  console.log(`✅ Added position: ${lat.toFixed(5)}, ${lon.toFixed(5)} (distance: ${distance.toFixed(1)}m, time: ${timeDiff.toFixed(1)}s)`);
  return true;
}

/**
 * Main function
 */
async function main() {
  console.log(`\n🚤 AIS Track Updater`);
  console.log(`MMSI: ${MMSI}`);
  console.log(`Track file: ${TRACK_FILE}\n`);

  try {
    // Fetch current position
    console.log('📡 Fetching vessel position from AISStream...');
    const vesselData = await fetchVesselPosition();
    
    // AISStream returns an array of vessels, or may return a single vessel
    let vessel = null;
    if (Array.isArray(vesselData)) {
      vessel = vesselData[0];
    } else if (vesselData && typeof vesselData === 'object') {
      vessel = vesselData;
    }

    if (!vessel) {
      console.error('❌ No vessel data received from AISStream');
      process.exit(1);
    }

    console.log(`✅ Received data for: ${vessel.ShipName || vessel.CallSign || MMSI}`);

    // Extract position data
    const lat = vessel.Latitude;
    const lon = vessel.Longitude;
    const sog = vessel.SOG;
    const cog = vessel.COG;
    const timestamp = new Date().toISOString();

    if (lat === undefined || lon === undefined) {
      console.error('❌ No valid position data in vessel response');
      console.error('Response:', JSON.stringify(vessel, null, 2));
      process.exit(1);
    }

    console.log(`   Position: ${lat.toFixed(5)}°N, ${lon.toFixed(5)}°E`);
    console.log(`   Speed: ${sog} kt, Course: ${cog}°`);

    // Load and update track file
    console.log('\n📋 Loading track file...');
    const track = loadTrackFile();
    console.log(`   Features in track: ${track.features?.length || 0}`);

    console.log('\n📍 Checking sampling criteria...');
    const added = addPositionToTrack(track, lat, lon, sog, cog, timestamp);

    if (added) {
      console.log('\n💾 Saving track file...');
      const saved = saveTrackFile(track);
      if (!saved) {
        process.exit(1);
      }
      console.log(`   ✅ Updated track now has ${track.features.length} points`);
    } else {
      console.log('   No update needed');
    }

    console.log('\n✅ Update complete!\n');
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exit(1);
  }
}

main();
