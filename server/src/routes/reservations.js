import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = Router();

function roundTo30Min(d) {
  const t = new Date(d);
  const min = t.getMinutes();
  const rounded = min < 30 ? 0 : 30;
  t.setMinutes(rounded, 0, 0);
  return t;
}

// 翌月末 23:59:59
function getAdminLimit(reservationDate) {
  const d = new Date(reservationDate);
  d.setMonth(d.getMonth() + 2);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
}

// 月間カレンダー用: 日付ごとの予約件数
router.get('/calendar', requireAuth, async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'year, month を指定してください' });
  const y = parseInt(year, 10);
  const m = parseInt(month, 10) - 1;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  const list = await prisma.reservation.findMany({
    where: {
      startAt: { gte: start },
      endAt: { lte: end },
    },
    select: { startAt: true },
  });
  const counts = {};
  list.forEach((r) => {
    const key = `${r.startAt.getFullYear()}-${String(r.startAt.getMonth() + 1).padStart(2, '0')}-${String(r.startAt.getDate()).padStart(2, '0')}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  res.json({ counts });
});

// 日別予約一覧（時間昇順）
router.get('/by-date', requireAuth, async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date (YYYY-MM-DD) を指定してください' });
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59);
  const reservations = await prisma.reservation.findMany({
    where: {
      startAt: { gte: start },
      endAt: { lte: end },
    },
    orderBy: { startAt: 'asc' },
    include: {
      user: { select: { id: true, name: true, studentId: true, iconPath: true } },
      band: { select: { id: true, name: true } },
    },
  });
  res.json({
    reservations: reservations.map((r) => ({
      id: r.id,
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      location: r.location,
      band: r.band,
      memo: r.memo,
      user: r.user,
    })),
  });
});

// 予約作成（自動承認・予約者=ログインユーザー）
router.post('/', requireAuth, async (req, res) => {
  try {
    const { startAt, endAt, location, bandId, memo } = req.body;
    if (!startAt || !endAt || !location) {
      return res.status(400).json({ error: '開始日時・終了日時・場所は必須です' });
    }
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ error: '有効な開始・終了日時を指定してください' });
    }
    if (!['ROOM_802_FRONT', 'ROOM_802_PERSONAL', 'STUDIO'].includes(location)) {
      return res.status(400).json({ error: '無効な場所です' });
    }
    const now = new Date();
    if (start < now && !req.session.isAdmin) {
      return res.status(403).json({ error: '過去の日付への予約追加は管理者のみ可能です' });
    }
    if (location === 'ROOM_802_FRONT') {
      const overlap = await prisma.reservation.findFirst({
        where: {
          location: 'ROOM_802_FRONT',
          startAt: { lt: end },
          endAt: { gt: start },
        },
      });
      if (overlap) {
        return res.status(400).json({ error: '802前方はこの時間帯に既に予約があります。重複予約はできません。' });
      }
    }
    const reservation = await prisma.reservation.create({
      data: {
        startAt: start,
        endAt: end,
        location,
        bandId: bandId || null,
        memo: memo || null,
        userId: req.session.userId,
      },
      include: {
        user: { select: { id: true, name: true, studentId: true, iconPath: true } },
        band: { select: { id: true, name: true } },
      },
    });
    res.status(201).json({
      reservation: {
        id: reservation.id,
        startAt: reservation.startAt.toISOString(),
        endAt: reservation.endAt.toISOString(),
        location: reservation.location,
        band: reservation.band,
        memo: reservation.memo,
        user: reservation.user,
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '予約に失敗しました' });
  }
});

// 予約編集
router.patch('/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!reservation) return res.status(404).json({ error: '予約が見つかりません' });

  const now = new Date();
  const isAdmin = req.session.isAdmin;

  if (!isAdmin) {
    if (reservation.userId !== req.session.userId) {
      return res.status(403).json({ error: '他人の予約は編集できません' });
    }
    if (reservation.startAt < now) {
      return res.status(403).json({ error: '過去の予約は編集できません' });
    }
  } else {
    const adminLimit = getAdminLimit(reservation.startAt);
    if (now > adminLimit) {
      return res.status(403).json({ error: '翌月末を過ぎた予約は編集できません' });
    }
  }

  const { startAt, endAt, location, bandId, memo } = req.body;
  const data = {};
  if (startAt != null) data.startAt = new Date(startAt);
  if (endAt != null) data.endAt = new Date(endAt);
  if (location != null) data.location = location;
  if (bandId !== undefined) data.bandId = bandId || null;
  if (memo !== undefined) data.memo = memo || null;

  const finalStart = data.startAt || reservation.startAt;
  const finalEnd = data.endAt || reservation.endAt;
  const finalLocation = data.location || reservation.location;

  if (finalLocation === 'ROOM_802_FRONT') {
    const overlap = await prisma.reservation.findFirst({
      where: {
        id: { not: id },
        location: 'ROOM_802_FRONT',
        startAt: { lt: finalEnd },
        endAt: { gt: finalStart },
      },
    });
    if (overlap) {
      return res.status(400).json({ error: '802前方はこの時間帯に既に予約があります。重複予約はできません。' });
    }
  }

  const updated = await prisma.reservation.update({
    where: { id },
    data: { ...data, startAt: finalStart, endAt: finalEnd, location: finalLocation },
    include: {
      user: { select: { id: true, name: true, studentId: true, iconPath: true } },
      band: { select: { id: true, name: true } },
    },
  });
  res.json({
    reservation: {
      id: updated.id,
      startAt: updated.startAt.toISOString(),
      endAt: updated.endAt.toISOString(),
      location: updated.location,
      band: updated.band,
      memo: updated.memo,
      user: updated.user,
    },
  });
});

// 予約削除
router.delete('/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const reservation = await prisma.reservation.findUnique({
    where: { id },
  });
  if (!reservation) return res.status(404).json({ error: '予約が見つかりません' });

  const now = new Date();
  const isAdmin = req.session.isAdmin;

  if (!isAdmin) {
    if (reservation.userId !== req.session.userId) {
      return res.status(403).json({ error: '他人の予約は削除できません' });
    }
    if (reservation.startAt < now) {
      return res.status(403).json({ error: '過去の予約は削除できません' });
    }
  } else {
    const adminLimit = getAdminLimit(reservation.startAt);
    if (now > adminLimit) {
      return res.status(403).json({ error: '翌月末を過ぎた予約は削除できません' });
    }
  }

  await prisma.reservation.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
