import http from 'node:http';
import { WebSocketServer } from 'ws';
import { setupWSConnection, getYDoc, docs } from 'y-websocket/bin/utils';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import storage, { type UserInfo } from '../services/storage.js';
import config from '../config.js';

export { docs, getYDoc };

interface WSConnectionParams {
  docId: string;
  userId: string;
  userName: string;
  userColor?: string;
}

function parseConnectionUrl(url: string | undefined): WSConnectionParams | null {
  if (!url) return null;

  try {
    const urlObj = new URL(url, 'http://localhost');
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const docId = pathParts[pathParts.length - 1];
    const userId = urlObj.searchParams.get('userId') || crypto.randomUUID();
    const userName = decodeURIComponent(urlObj.searchParams.get('userName') || 'Anonymous');
    const userColor = urlObj.searchParams.get('userColor') || undefined;

    if (!docId) return null;

    return { docId, userId, userName, userColor };
  } catch {
    return null;
  }
}

const COLORS = [
  '#f97316',
  '#a855f7',
  '#ec4899',
  '#06b6d4',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
];

function getNextColor(usedColors: string[]): string {
  return COLORS.find((c) => !usedColors.includes(c)) || COLORS[0];
}

const snapshotTimers = new Map<string, NodeJS.Timeout>();

function scheduleSnapshot(docId: string) {
  if (snapshotTimers.has(docId)) return;

  const timer = setInterval(async () => {
    try {
      const ydoc = getYDoc(docId, false);
      if (ydoc && ydoc.conns && ydoc.conns.size > 0) {
        const Y = await import('yjs');
        const state = Y.encodeStateAsUpdate(ydoc);
        await storage.saveSnapshot(docId, Buffer.from(state));
      }
    } catch (err) {
      console.error(`[Snapshot] Failed for ${docId}:`, err);
    }
  }, config.snapshotInterval);

  timer.unref();
  snapshotTimers.set(docId, timer);
}

export function setupWebSocketServer(server: http.Server): void {
  const wss = new WebSocketServer({ noServer: true });

  server.on(
    'upgrade',
    async (request: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = request.url;
      if (!url || !url.startsWith('/ws/')) {
        socket.destroy();
        return;
      }

      const params = parseConnectionUrl(url);
      if (!params) {
        socket.destroy();
        return;
      }

      const { docId, userId, userName } = params;
      try {
        const users = await storage.getUsers(docId);
        const usedColors = users.map((u) => u.color);
        const userColor = params.userColor || getNextColor(usedColors);

        const userInfo: UserInfo = {
          id: userId,
          name: userName,
          color: userColor,
        };

        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request, { docId, userInfo });
        });
      } catch (err) {
        console.error('[WS] Upgrade error:', err);
        socket.destroy();
      }
    }
  );

  wss.on(
    'connection',
    async (
      ws,
      _request,
      context: { docId: string; userInfo: UserInfo }
    ) => {
      const { docId, userInfo } = context;

      try {
        await storage.addUser(docId, userInfo);
      } catch (err) {
        console.error('[WS] Failed to add user:', err);
      }

      scheduleSnapshot(docId);

      setupWSConnection(ws, _request as unknown as IncomingMessage, {
        docName: docId,
        gc: true,
      });

      ws.on('close', async () => {
        try {
          await storage.removeUser(docId, userInfo.id);
        } catch (err) {
          console.error('[WS] Failed to remove user:', err);
        }
      });

      ws.on('error', (err) => {
        console.error('[WS] WebSocket error:', err);
      });
    }
  );

  console.log('[WS] WebSocket server ready on /ws/*');
}

export default setupWebSocketServer;
