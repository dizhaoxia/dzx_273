import http from 'node:http';
import app from './app.js';
import config from './config.js';
import setupWebSocketServer from './websocket/setup.js';
import storage from './services/storage.js';

const PORT = config.port;

async function start() {
  try {
    await storage.connect();
    console.log('[Storage] Connected to storage backend');
  } catch (err) {
    console.error('[Storage] Failed to connect:', err);
  }

  const server = http.createServer(app);

  setupWebSocketServer(server);

  server.listen(PORT, () => {
    console.log(`[Server] HTTP server ready on port ${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
    console.log(`[Server] WebSocket: ws://localhost:${PORT}/ws/{docId}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[Server] ${signal} signal received, shutting down...`);
    server.close(async () => {
      await storage.disconnect();
      console.log('[Server] Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});

export default app;
