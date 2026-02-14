/* ============================================================
    MAP COMPONENT - Static GeoJSON Track Display
    Uses Leaflet + Esri.WorldImagery satellite tiles
    Loads `data/track.geojson` on page load and displays current position
    ============================================================ */

// Configuration: replace with your boat's MMSI if needed
const MAP_CONFIG = {
  mmsi: 9362786,
  sampleThresholdTime: 30, // seconds between persisted points (for updater)
  sampleThresholdDistance: 100, // meters minimum distance between points
  center: [60.1699, 24.9384],
  zoom: 8,
  trackFile: './data/track.geojson',
};

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const ESRI_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

let mapState = {
  map: null,
  markersLayer: null,
  trackLayer: null,
  currentMarker: null,
  currentFix: null,
  trackGeoJSON: null,
  mapCentered: false,
};

async function initMap(containerId) {
  // Load Leaflet CSS
  if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_CSS;
    document.head.appendChild(link);
  }

  if (typeof L === 'undefined') {
    await loadScript(LEAFLET_JS);
  }

  const el = document.getElementById(containerId);
  if (!el) {
    console.error(`[MAP] Container ${containerId} not found`);
    return;
  }

  mapState.map = L.map(el).setView(MAP_CONFIG.center, MAP_CONFIG.zoom);

  L.tileLayer(ESRI_TILE_URL, {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18,
  }).addTo(mapState.map);

  mapState.trackLayer = L.layerGroup().addTo(mapState.map);
  mapState.markersLayer = L.layerGroup().addTo(mapState.map);

  // Load static GeoJSON track file
  await loadTrackFile(MAP_CONFIG.trackFile);

  // If we have a last point, show it
  if (mapState.currentFix) {
    updateInfoBoxes(mapState.currentFix.lat, mapState.currentFix.lon, mapState.currentFix.sog || 0);
    // center map on last known position
    mapState.map.setView([mapState.currentFix.lat, mapState.currentFix.lon], MAP_CONFIG.zoom);
    mapState.mapCentered = true;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function loadTrackFile(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      console.warn('[MAP] track.geojson not found or could not be loaded:', resp.status);
      return;
    }

    const geo = await resp.json();
    mapState.trackGeoJSON = geo;

    // If features exist, set currentFix to last feature
    if (geo && geo.type === 'FeatureCollection' && geo.features && geo.features.length > 0) {
      const last = geo.features[geo.features.length - 1];
      const [lon, lat] = last.geometry.coordinates;
      mapState.currentFix = {
        lat,
        lon,
        sog: last.properties?.sog || 0,
        cog: last.properties?.cog || 0,
        timestamp: last.properties?.timestamp || new Date().toISOString(),
      };
    }

    redrawTrackPolyline();
    if (mapState.currentFix) {
      updateMarker(mapState.currentFix.lat, mapState.currentFix.lon, mapState.currentFix.sog, mapState.currentFix.cog);
    }
  } catch (err) {
    console.error('[MAP] Error loading track file:', err.message);
  }
}

function redrawTrackPolyline() {
  mapState.trackLayer.clearLayers();
  if (!mapState.trackGeoJSON || !Array.isArray(mapState.trackGeoJSON.features) || mapState.trackGeoJSON.features.length < 2) return;

  const latlngs = mapState.trackGeoJSON.features.map((f) => {
    const [lon, lat] = f.geometry.coordinates;
    return [lat, lon];
  });

  L.polyline(latlngs, { color: '#0066ff', weight: 2, opacity: 0.8 }).addTo(mapState.trackLayer);
}

function updateMarker(lat, lon, sog, cog) {
  if (mapState.currentMarker) {
    mapState.markersLayer.removeLayer(mapState.currentMarker);
  }

  const iconHtml = `<div style="width:30px;height:30px;background:#ff6b6b;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);transform:rotate(${cog}deg);">⛵</div>`;

  const icon = L.divIcon({ html: iconHtml, className: 'boat-marker', iconSize: [30, 30], iconAnchor: [15, 15] });

  mapState.currentMarker = L.marker([lat, lon], { icon })
    .bindPopup(`<div style="text-align:center;"><strong>Our Boat</strong><br>Lat: ${lat.toFixed(5)}°<br>Lon: ${lon.toFixed(5)}°<br>Speed: ${sog} kt</div>`)
    .addTo(mapState.markersLayer);
}

function updateInfoBoxes(lat, lon, sog) {
  const latDM = decimalToDMS(Math.abs(lat), lat >= 0 ? 'N' : 'S');
  const lonDM = decimalToDMS(Math.abs(lon), lon >= 0 ? 'E' : 'W');
  updateInfoBox('ais-latitude', latDM);
  updateInfoBox('ais-longitude', lonDM);
  updateInfoBox('ais-wind', '--');
  updateInfoBox('ais-distance', mapState.trackGeoJSON?.features?.length || 0);
  updateInfoBox('ais-localtime', new Date().toLocaleTimeString('en-GB'));
}

function decimalToDMS(decimal, direction) {
  const degrees = Math.floor(decimal);
  const decimalMinutes = (decimal - degrees) * 60;
  const minutes = Math.floor(decimalMinutes);
  const seconds = Math.round((decimalMinutes - minutes) * 60);
  return `${degrees}°${minutes}'${seconds}"${direction}`;
}

function updateInfoBox(elementId, value) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = String(value);
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Export helper kept for convenience
function exportTrackAsGeoJSON() {
  if (!mapState.trackGeoJSON || mapState.trackGeoJSON.features.length === 0) {
    alert('No track data to export');
    return null;
  }
  const dataStr = JSON.stringify(mapState.trackGeoJSON, null, 2);
  const blob = new Blob([dataStr], { type: 'application/geo+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `boat_track_${new Date().toISOString().split('T')[0]}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
  return dataStr;
}

// Expose initMap globally for loadHTML hook
window.initMap = initMap;
