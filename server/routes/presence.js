const express = require('express');
const router = express.Router();
const { authMiddleware, adminOnly } = require('../middleware/auth');
const db = require('../utils/db');

router.get('/', authMiddleware, adminOnly, async (req, res) => {
  const { date, type, user_id, month, year } = req.query;
  const presences = await db.getPresences({ date, type, userId: user_id, month, year });
  res.json(presences.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
});
router.get('/today', authMiddleware, async (req, res) => {
  res.json(await db.getTodayPresences());
});
router.get('/history/:userId', authMiddleware, adminOnly, async (req, res) => {
  const { month, year } = req.query;
  const p = await db.getPresences({ userId: req.params.userId, month, year });
  res.json(p.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)));
});
module.exports = router;
