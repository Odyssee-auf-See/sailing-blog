/**
 * AIS WebSocket Proxy Server
 * Connects to aisstream.io and relays data to frontend clients
 * 
 * Usage: node ais-proxy.js
 * Frontend connects to: ws://localhost:3001
 */

const WebSocket = require('ws');
const http = require('http');

// ====== CONFIGURATION ======
const AIS_CONFIG = {
  mmsi: '9362786',  // REPLACE with your boat MMSI
  apiKey: '9258446cc328cd91f09fa81fd6e1b020fb113a28',  // REPLACE with your aisstream.io API key
};

const PORT = 3001;

// ====== STATE ======
let aisWebSocket = null;
let serverClients = []; // Track all connected frontend clients
let isConnectedToAIS = false;

// ====== HTTP SERVER ======
const server = http.createServer((req, res) => {
  // Health check endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'running',
      connectedToAIS: isConnectedToAIS,
      frontendClients: serverClients.length,
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

// ====== WEBSOCKET SERVER (for frontend clients) ======
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[PROXY] New frontend client connected from ${clientIp}`);
  serverClients.push(ws);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Connected to AIS proxy',
    aisStatus: isConnectedToAIS ? 'connected' : 'disconnected',
  }));

  ws.on('close', () => {
    console.log(`[PROXY] Frontend client disconnected from ${clientIp}`);
    serverClients = serverClients.filter(client => client !== ws);
  });

  ws.on('error', (err) => {
    console.error(`[PROXY] Frontend client error from ${clientIp}:`, err.message);
  });
});

// ====== AIS WEBSOCKET CONNECTION ======
/**
 * Connect to aisstream.io and relay messages to all frontend clients
 */
function connectToAISStream() {
  console.log('[PROXY] Attempting to connect to aisstream.io...');
  console.log(`[PROXY] Configuration: MMSI=${AIS_CONFIG.mmsi}, API Key=${AIS_CONFIG.apiKey.substring(0, 10)}...`);

  try {
    aisWebSocket = new WebSocket('wss://stream.aisstream.io/v0/stream');

    aisWebSocket.on('open', () => {
      console.log('[PROXY] ✅ Successfully connected to aisstream.io');
      isConnectedToAIS = true;

      // Send subscription message
      const subscriptionMessage = {
        Apikey: AIS_CONFIG.apiKey,
        BoundingBoxes: [
          [[-90, -180], [90, 180]], // Global coverage
        ],
        FiltersShipMMSI: [AIS_CONFIG.mmsi], // Filter to specific boat
        FilterMessageTypes: ['PositionReport'],
      };

      aisWebSocket.send(JSON.stringify(subscriptionMessage));
      console.log(`[PROXY] Subscription sent for MMSI: ${AIS_CONFIG.mmsi}`);

      // Notify all frontend clients
      broadcastToClients({
        type: 'ais-connected',
        message: 'AIS connection established',
      });
    });

    aisWebSocket.on('message', (data) => {
      try {
        const aisMessage = JSON.parse(data);
        console.log(`[PROXY] Received AIS message from aisstream.io, relaying to ${serverClients.length} client(s)`);

        // Relay to all connected frontend clients
        broadcastToClients(aisMessage);
      } catch (err) {
        console.error('[PROXY] Error parsing AIS message:', err.message);
      }
    });

    aisWebSocket.on('error', (err) => {
      console.error(`[PROXY] ❌ aisstream.io error: ${err.message}`);
      isConnectedToAIS = false;

      broadcastToClients({
        type: 'ais-error',
        message: 'AIS connection error',
        error: err.message,
      });
    });

    aisWebSocket.on('close', () => {
      console.warn('[PROXY] ⚠️  Disconnected from aisstream.io');
      isConnectedToAIS = false;

      broadcastToClients({
        type: 'ais-disconnected',
        message: 'AIS connection lost, will reconnect...',
      });

      // Reconnect after 5 seconds
      setTimeout(() => {
        console.log('[PROXY] Attempting to reconnect to aisstream.io...');
        connectToAISStream();
      }, 5000);
    });
  } catch (err) {
    console.error('[PROXY] Failed to create WebSocket:', err.message);
    isConnectedToAIS = false;

    // Retry after 5 seconds
    setTimeout(() => {
      connectToAISStream();
    }, 5000);
  }
}

/**
 * Send message to all connected frontend clients
 */
function broadcastToClients(data) {
  const message = JSON.stringify(data);
  let successCount = 0;
  let failureCount = 0;

  serverClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
        successCount++;
      } catch (err) {
        console.error('[PROXY] Error sending to client:', err.message);
        failureCount++;
      }
    }
  });

  if (failureCount > 0) {
    console.log(`[PROXY] Broadcast: ${successCount} sent, ${failureCount} failed`);
  }
}

// ====== START SERVER ======
server.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[PROXY] 🚀 AIS Proxy Server running on ws://localhost:${PORT}`);
  console.log(`[PROXY] Frontend should connect to: ws://localhost:${PORT}`);
  console.log(`[PROXY] Health check: http://localhost:${PORT}/health`);
  console.log(`${'='.repeat(60)}\n`);

  // Initial connection to aisstream.io
  connectToAISStream();
});

// ====== GRACEFUL SHUTDOWN ======
process.on('SIGINT', () => {
  console.log('\n[PROXY] 🛑 Shutting down gracefully...');

  // Close all frontend connections
  serverClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.close(1000, 'Server shutting down');
    }
  });

  // Close AIS connection
  if (aisWebSocket && aisWebSocket.readyState === WebSocket.OPEN) {
    aisWebSocket.close(1000, 'Server shutting down');
  }

  // Close server
  server.close(() => {
    console.log('[PROXY] Server closed. Goodbye!');
    process.exit(0);
  });

  // Force exit after 5 seconds
  setTimeout(() => {
    console.error('[PROXY] Force shutdown (timeout)');
    process.exit(1);
  }, 5000);
});
