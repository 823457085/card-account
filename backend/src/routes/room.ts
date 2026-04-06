import { Router } from 'express';
import * as roomService from '../services/room.js';
import { broadcastRoomUpdate } from '../websocket/manager.js';

const router = Router();

// GET /api/rooms - list all active rooms
router.get('/', (_req, res) => {
  const rooms = roomService.getAllRooms();
  res.json({ success: true, data: rooms });
});

// POST /api/rooms - create room
router.post('/', (req, res) => {
  const { name, gameType, initialScore, unitAmount, playerName } = req.body;
  if (!name || !gameType || !playerName) {
    return res.status(400).json({ success: false, error: 'Missing required fields: name, gameType, playerName' });
  }
  if (!['mahjong', 'poker', 'guandan', 'custom'].includes(gameType)) {
    return res.status(400).json({ success: false, error: 'Invalid gameType' });
  }
  if (playerName.length < 2 || playerName.length > 8) {
    return res.status(400).json({ success: false, error: 'playerName must be 2-8 characters' });
  }
  const room = roomService.createRoom({ name, gameType, initialScore, unitAmount, playerName });
  res.status(201).json({ success: true, data: room });
});

// GET /api/rooms/:roomId - get room info
router.get('/:roomId', (req, res) => {
  const room = roomService.getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
  res.json({ success: true, data: room });
});

// POST /api/rooms/:roomId/join - join room
router.post('/:roomId/join', (req, res) => {
  const { playerName } = req.body;
  if (!playerName) return res.status(400).json({ success: false, error: 'playerName required' });
  const room = roomService.joinRoom(req.params.roomId, playerName);
  if (!room) return res.status(404).json({ success: false, error: 'Room not found or full' });
  broadcastRoomUpdate(req.params.roomId);
  res.json({ success: true, data: room });
});

// POST /api/rooms/:roomId/leave - leave room
router.post('/:roomId/leave', (req, res) => {
  const { playerId } = req.body;
  if (!playerId) return res.status(400).json({ success: false, error: 'playerId required' });
  roomService.leaveRoom(req.params.roomId, playerId);
  broadcastRoomUpdate(req.params.roomId);
  res.json({ success: true });
});

// DELETE /api/rooms/:roomId - delete room
router.delete('/:roomId', (req, res) => {
  roomService.deleteRoom(req.params.roomId);
  res.json({ success: true });
});

// POST /api/rooms/:roomId/players - add player
router.post('/:roomId/players', (req, res) => {
  const { playerName } = req.body;
  if (!playerName) return res.status(400).json({ success: false, error: 'playerName required' });
  const player = roomService.addPlayer(req.params.roomId, playerName);
  if (!player) return res.status(400).json({ success: false, error: 'Room full or not found' });
  broadcastRoomUpdate(req.params.roomId);
  res.status(201).json({ success: true, data: player });
});

// DELETE /api/rooms/:roomId/players/:playerId - remove player
router.delete('/:roomId/players/:playerId', (req, res) => {
  roomService.removePlayer(req.params.roomId, req.params.playerId);
  broadcastRoomUpdate(req.params.roomId);
  res.json({ success: true });
});

// POST /api/rooms/:roomId/rounds - record a round
router.post('/:roomId/rounds', (req, res) => {
  const { winners, losers, amount } = req.body;
  if (!winners || !losers || amount == null) {
    return res.status(400).json({ success: false, error: 'winners, losers, amount required' });
  }
  const round = roomService.recordRound(req.params.roomId, { winners, losers, amount });
  if (!round) return res.status(400).json({ success: false, error: 'Failed to record round' });
  broadcastRoomUpdate(req.params.roomId);
  res.status(201).json({ success: true, data: round });
});

// DELETE /api/rooms/:roomId/rounds - undo last round
router.delete('/:roomId/rounds', (req, res) => {
  const round = roomService.undoRound(req.params.roomId);
  if (!round) return res.status(400).json({ success: false, error: 'No rounds to undo' });
  broadcastRoomUpdate(req.params.roomId);
  res.json({ success: true, data: round });
});

// POST /api/rooms/:roomId/settle - settle room
router.post('/:roomId/settle', (req, res) => {
  const result = roomService.settleRoom(req.params.roomId);
  if (!result) return res.status(404).json({ success: false, error: 'Room not found' });
  broadcastRoomUpdate(req.params.roomId);
  res.json({ success: true, data: result });
});

// GET /api/rooms/:roomId/poll - long-polling endpoint (waits for room update)
router.get('/:roomId/poll', (req, res) => {
  const roomId = req.params.roomId;
  const since = parseInt(req.query.since as string) || 0;

  const checkRoom = () => {
    const room = roomService.getRoom(roomId);
    if (!room) return null;
    if (room.updatedAt > since) return room;
    return null;
  };

  // Check immediately
  const room = checkRoom();
  if (room) return res.json({ success: true, data: room });

  // Long poll with 25s timeout
  const timeout = setTimeout(() => {
    res.json({ success: true, data: null, timeout: true });
  }, 25000);

  const interval = setInterval(() => {
    const r = checkRoom();
    if (r) {
      clearTimeout(timeout);
      clearInterval(interval);
      res.json({ success: true, data: r });
    }
  }, 1000);

  req.on('close', () => {
    clearTimeout(timeout);
    clearInterval(interval);
  });
});

export default router;
