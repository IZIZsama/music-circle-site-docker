import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function scoreMinutes(minutes) {
  return Math.floor(minutes / 30);
}

router.get('/', requireAuth, async (req, res) => {
  const { period, type } = req.query;
  if (!period || !type) {
    return res.status(400).json({ error: 'period と type を指定してください' });
  }
  const now = new Date();
  let startDate;
  if (period === 'this_month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (period === 'last_30_days') {
    startDate = new Date(now);
    startDate.setDate(startDate.getDate() - 30);
  } else if (period === 'total') {
    startDate = new Date(0);
  } else {
    return res.status(400).json({ error: '無効な period です' });
  }

  const isAdmin = req.session.isAdmin;
  const limit = isAdmin ? undefined : 3;

  if (type === 'user') {
    const [reservations] = await pool.query(
      `SELECT userId, startAt, endAt FROM \`Reservation\` WHERE startAt >= ?`,
      [startDate],
    );
    const byUser = {};
    reservations.forEach((r) => {
      const min = (new Date(r.endAt) - new Date(r.startAt)) / (60 * 1000);
      const pts = scoreMinutes(min);
      byUser[r.userId] = (byUser[r.userId] || 0) + pts;
    });
    const userIds = Object.keys(byUser);
    let users = [];
    if (userIds.length) {
      const ph = userIds.map(() => '?').join(',');
      const [urows] = await pool.query(
        `SELECT id, name, iconPath, studentId FROM \`User\` WHERE id IN (${ph})`,
        userIds,
      );
      users = urows;
    }
    const map = Object.fromEntries(users.map((u) => [u.id, u]));
    let ranking = userIds
      .map((uid) => ({ user: map[uid], score: byUser[uid] }))
      .sort((a, b) => b.score - a.score);
    if (limit) ranking = ranking.slice(0, limit);
    const myId = req.session.userId;
    const myEntry = userIds.includes(myId)
      ? { user: map[myId], score: byUser[myId] }
      : { user: users.find((u) => u.id === myId), score: 0 };
    const myRank = userIds.indexOf(myId) + 1;
    return res.json({
      period,
      type: 'user',
      ranking,
      myScore: myEntry,
      myRank: myRank || null,
      showAll: isAdmin,
    });
  }

  if (type === 'band') {
    const [reservations] = await pool.query(
      `SELECT bandId, startAt, endAt FROM \`Reservation\`
       WHERE startAt >= ? AND bandId IS NOT NULL`,
      [startDate],
    );
    const byBand = {};
    reservations.forEach((r) => {
      const min = (new Date(r.endAt) - new Date(r.startAt)) / (60 * 1000);
      const pts = scoreMinutes(min);
      byBand[r.bandId] = (byBand[r.bandId] || 0) + pts;
    });
    const bandIds = Object.keys(byBand);
    let bands = [];
    if (bandIds.length) {
      const ph = bandIds.map(() => '?').join(',');
      const [brows] = await pool.query(
        `SELECT id, name FROM \`Band\` WHERE id IN (${ph})`,
        bandIds,
      );
      bands = brows;
    }
    const map = Object.fromEntries(bands.map((b) => [b.id, b]));
    let ranking = bandIds
      .map((bid) => ({ band: map[bid], score: byBand[bid] }))
      .sort((a, b) => b.score - a.score);
    if (limit) ranking = ranking.slice(0, limit);
    const [myBands] = await pool.query(
      `SELECT b.id, b.name, b.createdAt, ub.bandId FROM \`UserBand\` ub
       INNER JOIN \`Band\` b ON b.id = ub.bandId WHERE ub.userId = ?`,
      [req.session.userId],
    );
    const myBandScores = myBands.map((ub) => ({
      band: { id: ub.id, name: ub.name, createdAt: ub.createdAt },
      score: byBand[ub.bandId] || 0,
    }));
    return res.json({
      period,
      type: 'band',
      ranking,
      myBandScores,
      showAll: isAdmin,
    });
  }

  return res.status(400).json({ error: '無効な type です' });
});

export default router;
