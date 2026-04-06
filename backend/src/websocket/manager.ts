import { WebSocketServer, WebSocket } from 'ws';

interface Client {
  ws: WebSocket;
  roomId?: string;
  playerId?: string;
}

const clients = new Map<WebSocket, Client>();

export function setupWebSocket(wss: WebSocketServer): void {
  wss.on('connection', (ws) => {
    clients.set(ws, { ws });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const client = clients.get(ws);
        if (!client) return;

        switch (msg.type) {
          case 'join_room':
            // Client wants to subscribe to room updates
            client.roomId = msg.roomId;
            client.playerId = msg.playerId;
            broadcastToRoom(msg.roomId, {
              type: 'player_joined',
              playerId: msg.playerId,
              playerName: msg.playerName
            }, ws);
            break;

          case 'leave_room':
            if (client.roomId) {
              broadcastToRoom(client.roomId, {
                type: 'player_left',
                playerId: client.playerId
              }, ws);
              client.roomId = undefined;
              client.playerId = undefined;
            }
            break;
        }
      } catch {}
    });

    ws.on('close', () => {
      const client = clients.get(ws);
      if (client?.roomId) {
        broadcastToRoom(client.roomId, {
          type: 'player_left',
          playerId: client.playerId
        }, ws);
      }
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });
}

export function broadcastToRoom(roomId: string, payload: object, exclude?: WebSocket): void {
  const msg = JSON.stringify(payload);
  for (const [ws, client] of clients) {
    if (client.roomId === roomId && ws !== exclude && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export function broadcastRoomUpdate(roomId: string): void {
  // Caller will fetch fresh room data and broadcast
  broadcastToRoom(roomId, { type: 'room_updated', roomId });
}
