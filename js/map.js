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
  zoom: 9,
  trackFile: './data/track.geojson',
  atonFile: './data/aton.geojson',
};

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const ESRI_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_LABELS_TILE_URL = 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

let mapState = {
  map: null,
  markersLayer: null,
  trackLayer: null,
  atonLayer: null,
  labelsLayer: null,
  atonVisible: true,
  labelsVisible: true,
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

  // --- 1. INITIALIZE MAP ---
  mapState.map = L.map(el, {
    scrollWheelZoom: false,
  }).setView(MAP_CONFIG.center, MAP_CONFIG.zoom);

// --- 2. DYNAMIC HINT OVERLAY ---
  const hint = document.createElement('div');
  hint.className = 'scroll-hint-overlay';
  hint.innerText = 'Use [Ctrl] + Scroll to Zoom';
  el.appendChild(hint);

  // Toggle zoom capability based on Ctrl key
  const handleScrollZoom = (e) => {
    if (e.ctrlKey || e.metaKey) {
      mapState.map.scrollWheelZoom.enable();
      hint.classList.remove('visible'); 
    } else {
      mapState.map.scrollWheelZoom.disable();
    }
  };

  // Listen for the wheel event on the map container
  el.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) {
      hint.classList.add('visible');
      clearTimeout(el.hintTimer);
      el.hintTimer = setTimeout(() => {
        hint.classList.remove('visible');
      }, 2000);
    }
  }, { passive: true });

  window.addEventListener('keydown', handleScrollZoom);
  window.addEventListener('keyup', handleScrollZoom);

  // --- 3. TILES AND LAYERS ---
  L.tileLayer(ESRI_TILE_URL, {
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18,
  }).addTo(mapState.map);

  mapState.labelsLayer = L.tileLayer(ESRI_LABELS_TILE_URL, {
    attribution: 'Labels &copy; Esri',
    maxZoom: 18,
  });
  setLabelsVisibility(mapState.labelsVisible);

  mapState.trackLayer = L.layerGroup().addTo(mapState.map);
  mapState.markersLayer = L.layerGroup().addTo(mapState.map);
  mapState.atonLayer = L.layerGroup().addTo(mapState.map);
  addAtonToggleControl();

  await loadTrackFile(MAP_CONFIG.trackFile);
  await loadAtonFile(MAP_CONFIG.atonFile);

  if (mapState.currentFix) {
    updateInfoBoxes(
        mapState.currentFix.lat, 
        mapState.currentFix.lon, 
        mapState.currentFix.sog, 
        mapState.currentFix.cog, 
        mapState.currentFix.timestamp
    );
    mapState.map.setView([mapState.currentFix.lat, mapState.currentFix.lon], MAP_CONFIG.zoom);
    mapState.mapCentered = true;
  }
}

function addAtonToggleControl() {
  const control = L.control({ position: 'bottomleft' });

  control.onAdd = () => {
    const container = L.DomUtil.create('div', 'aton-toggle-control');
    container.innerHTML = `
      <div class="map-layer-toggles">
        <label class="aton-toggle">
          <input type="checkbox" data-layer="labels" checked />
          <span>Ortsnamen</span>
        </label>
      </div>
    `;

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    container.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
      checkbox.addEventListener('change', (event) => {
        if (event.target.dataset.layer === 'markers') {
          setAtonVisibility(event.target.checked);
          return;
        }

        if (event.target.dataset.layer === 'labels') {
          setLabelsVisibility(event.target.checked);
        }
      });
    });

    return container;
  };

  control.addTo(mapState.map);
}

function setLabelsVisibility(visible) {
  mapState.labelsVisible = visible;
  if (!mapState.labelsLayer) return;

  if (visible) {
    if (!mapState.map.hasLayer(mapState.labelsLayer)) {
      mapState.labelsLayer.addTo(mapState.map);
    }
  } else if (mapState.map.hasLayer(mapState.labelsLayer)) {
    mapState.map.removeLayer(mapState.labelsLayer);
  }
}

function setAtonVisibility(visible) {
  mapState.atonVisible = visible;
  if (visible) {
    if (!mapState.map.hasLayer(mapState.atonLayer)) {
      mapState.atonLayer.addTo(mapState.map);
    }
  } else if (mapState.map.hasLayer(mapState.atonLayer)) {
    mapState.map.removeLayer(mapState.atonLayer);
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

function getAtonTypeLabel(typeValue) {
  const type = Number(typeValue);
  const labels = {
    0: 'Not specified',
    1: 'Reference point',
    2: 'RACON',
    3: 'Fixed structure',
    4: 'Spare',
    5: 'Light',
    6: 'Light with sectors',
    7: 'Leading light (front)',
    8: 'Leading light (rear)',
    9: 'Beacon, cardinal N',
    10: 'Beacon, cardinal E',
    11: 'Beacon, cardinal S',
    12: 'Beacon, cardinal W',
    13: 'Beacon, port',
    14: 'Beacon, starboard',
    15: 'Beacon, preferred channel port',
    16: 'Beacon, preferred channel starboard',
    17: 'Beacon, isolated danger',
    18: 'Beacon, safe water',
    19: 'Beacon, special',
    20: 'Buoy, cardinal N',
    21: 'Buoy, cardinal E',
    22: 'Buoy, cardinal S',
    23: 'Buoy, cardinal W',
    24: 'Buoy, port',
    25: 'Buoy, starboard',
    26: 'Buoy, preferred channel port',
    27: 'Buoy, preferred channel starboard',
    28: 'Buoy, isolated danger',
    29: 'Buoy, safe water',
    30: 'Buoy, special',
    31: 'Light vessel/lanby/rig',
  };
  return labels[type] || 'Unknown';
}

function getAtonCategory(typeValue) {
  const type = Number(typeValue);
  if ([5, 6, 7, 8].includes(type)) return 'light';
  if (type >= 9 && type <= 19) return 'beacon';
  if (type >= 20 && type <= 30) return 'buoy';
  if ([1, 2, 3, 4, 31].includes(type)) return 'structure';
  return 'unknown';
}

function getAtonStyle(typeValue) {
  const category = getAtonCategory(typeValue);
  const styleByCategory = {
    light: { color: '#ffd54f', label: 'L' },
    beacon: { color: '#ff7043', label: 'B' },
    buoy: { color: '#26a69a', label: 'U' },
    structure: { color: '#8d6e63', label: 'S' },
    unknown: { color: '#9e9e9e', label: '?' },
  };
  return styleByCategory[category] || styleByCategory.unknown;
}

function formatAtonPopup(props, lat, lon) {
  const name = props?.name || 'AtoN';
  const nameExt = props?.nameExtension ? ` ${props.nameExtension}` : '';
  const typeLabel = getAtonTypeLabel(props?.type ?? props?.aton);
  const timestamp = props?.timestamp ? new Date(props.timestamp).toLocaleString() : '---';
  const dim = props?.dimension
    ? `A:${props.dimension.A ?? '-'} B:${props.dimension.B ?? '-'} C:${props.dimension.C ?? '-'} D:${props.dimension.D ?? '-'}`
    : '---';

  return [
    `<div style="text-align:center;"><strong>${name}${nameExt}</strong></div>`,
    `Type: ${typeLabel}`,
    `Lat: ${lat.toFixed(5)}°`,
    `Lon: ${lon.toFixed(5)}°`,
    `MMSI: ${props?.mmsi ?? '---'}`,
    `Virtual: ${props?.virtual ?? '---'}`,
    `Off position: ${props?.offPosition ?? '---'}`,
    `Accuracy: ${props?.positionAccuracy ?? '---'}`,
    `RAIM: ${props?.raim ?? '---'}`,
    `Fix type: ${props?.fixType ?? '---'}`,
    `Dimensions: ${dim}`,
    `Time: ${timestamp}`,
  ].join('<br>');
}

async function loadAtonFile(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return;

    const geo = await resp.json();
    if (!geo || geo.type !== 'FeatureCollection' || !Array.isArray(geo.features)) return;

    mapState.atonLayer.clearLayers();

    geo.features.forEach((feature) => {
      if (!feature?.geometry || feature.geometry.type !== 'Point') return;
      const [lon, lat] = feature.geometry.coordinates;
      const props = feature.properties || {};
      const style = getAtonStyle(props.type ?? props.aton);
      const iconHtml = `<div style="width:22px;height:22px;border-radius:50%;background:${style.color};color:#1b1b1b;font-weight:700;font-size:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,0.35);border:1px solid rgba(0,0,0,0.35);">${style.label}</div>`;
      const icon = L.divIcon({ html: iconHtml, className: 'aton-marker', iconSize: [22, 22], iconAnchor: [11, 11] });

      L.marker([lat, lon], { icon })
        .bindPopup(formatAtonPopup(props, lat, lon))
        .addTo(mapState.atonLayer);
    });
  } catch (err) {
    console.error('[MAP] Error loading aton file:', err.message);
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

  const iconHtml = `<div style="width:30px;height:30px;background:#ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);">⛵</div>`;

  const icon = L.divIcon({ html: iconHtml, className: 'boat-marker', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -30] });

  mapState.currentMarker = L.marker([lat, lon], { icon })
    .bindPopup(`<div style="text-align:center;"><strong>Odyssee</strong><br>Lat: ${lat.toFixed(5)}°<br>Lon: ${lon.toFixed(5)}°<br>Geschwindigkeit: ${sog} kt</div>`)
    .addTo(mapState.markersLayer);
}

function updateInfoBoxes(lat, lon, sog, cog, timestamp) {
  const latDM = decimalToDMS(Math.abs(lat), lat >= 0 ? 'N' : 'S');
  const lonDM = decimalToDMS(Math.abs(lon), lon >= 0 ? 'E' : 'W');
  
  // Use the IDs from your new map.html dashboard
  updateInfoBox('ais-pos', `${latDM} ${lonDM}`);
  updateInfoBox('ais-sog', sog.toFixed(1));
  updateInfoBox('ais-cog', Math.round(cog) || '---');
  
  if (timestamp) {
    const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    updateInfoBox('ais-time', time);
  }
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
