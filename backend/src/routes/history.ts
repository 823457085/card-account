import { Router } from 'express';
import * as roomService from '../services/room.js';

const router = Router();

// GET /api/history - get game history
router.get('/', (_req, res) => {
  const records = roomService.getHistory();
  res.json({ success: true, data: records });
});

export default router;
