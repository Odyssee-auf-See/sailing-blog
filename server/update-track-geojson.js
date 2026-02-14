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
    }, 3000);

    socket.on('open', () => {
      console.log('🌐 Connected to AISStream. Sending subscription...');
      const subscription = {
        APIKey: API_KEY,
        FiltersShipMMSI: [MMSI],
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
