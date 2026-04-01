import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = Router();

// 30分 = 1ポイント。予約時間(分)/30
function scoreMinutes(minutes) {
  return Math.floor(minutes / 30);
}

router.get('/', requireAuth, async (req, res) => {
  const { period, type } = req.query;
  // period: this_month | last_30_days | total
  // type: user | band
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
  const limit = isAdmin ? undefined : 3; // メンバーはTOP3のみ

  if (type === 'user') {
    const reservations = await prisma.reservation.findMany({
      where: { startAt: { gte: startDate } },
      select: { userId: true, startAt: true, endAt: true },
    });
    const byUser = {};
    reservations.forEach((r) => {
      const min = (r.endAt - r.startAt) / (60 * 1000);
      const pts = scoreMinutes(min);
      byUser[r.userId] = (byUser[r.userId] || 0) + pts;
    });
    const userIds = Object.keys(byUser);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, iconPath: true, studentId: true },
    });
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
    const reservations = await prisma.reservation.findMany({
      where: {
        startAt: { gte: startDate },
        bandId: { not: null },
      },
      select: { bandId: true, startAt: true, endAt: true },
    });
    const byBand = {};
    reservations.forEach((r) => {
      const min = (r.endAt - r.startAt) / (60 * 1000);
      const pts = scoreMinutes(min);
      byBand[r.bandId] = (byBand[r.bandId] || 0) + pts;
    });
    const bandIds = Object.keys(byBand);
    const bands = await prisma.band.findMany({
      where: { id: { in: bandIds } },
      select: { id: true, name: true },
    });
    const map = Object.fromEntries(bands.map((b) => [b.id, b]));
    let ranking = bandIds
      .map((bid) => ({ band: map[bid], score: byBand[bid] }))
      .sort((a, b) => b.score - a.score);
    if (limit) ranking = ranking.slice(0, limit);
    const myBands = await prisma.userBand.findMany({
      where: { userId: req.session.userId },
      include: { band: true },
    });
    const myBandScores = myBands.map((ub) => ({
      band: ub.band,
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
