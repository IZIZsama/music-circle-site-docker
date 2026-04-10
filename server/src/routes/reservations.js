import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function getAdminLimit(reservationDate) {
  const d = new Date(reservationDate);
  d.setMonth(d.getMonth() + 2);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function mapReservationRow(r) {
  return {
    id: r.id,
    startAt: new Date(r.startAt).toISOString(),
    endAt: new Date(r.endAt).toISOString(),
    location: r.location,
    band: r.bandId ? { id: r.bandId, name: r.bandName } : null,
    memo: r.memo,
    user: {
      id: r.userId,
      name: r.userName,
      studentId: r.userStudentId,
      iconPath: r.userIconPath,
    },
  };
}

router.get('/calendar', requireAuth, async (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) return res.status(400).json({ error: 'year, month を指定してください' });
  const y = parseInt(year, 10);
  const m = parseInt(month, 10) - 1;
  const start = new Date(y, m, 1);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  const [list] = await pool.query(
    `SELECT startAt FROM \`Reservation\`
     WHERE startAt >= ? AND endAt <= ?`,
    [start, end],
  );
  const counts = {};
  list.forEach((r) => {
    const d = new Date(r.startAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  res.json({ counts });
});

router.get('/by-date', requireAuth, async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date (YYYY-MM-DD) を指定してください' });
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0);
  const end = new Date(y, m - 1, d, 23, 59, 59);
  const [rows] = await pool.query(
    `SELECT r.id, r.startAt, r.endAt, r.location, r.memo, r.userId, r.bandId,
            u.name AS userName, u.studentId AS userStudentId, u.iconPath AS userIconPath,
            b.name AS bandName
     FROM \`Reservation\` r
     INNER JOIN \`User\` u ON u.id = r.userId
     LEFT JOIN \`Band\` b ON b.id = r.bandId
     WHERE r.startAt >= ? AND r.endAt <= ?
     ORDER BY r.startAt ASC`,
    [start, end],
  );
  res.json({ reservations: rows.map(mapReservationRow) });
});

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
      const [overlap] = await pool.query(
        `SELECT id FROM \`Reservation\`
         WHERE location = 'ROOM_802_FRONT' AND startAt < ? AND endAt > ? LIMIT 1`,
        [end, start],
      );
      if (overlap.length) {
        return res.status(400).json({ error: '802前方はこの時間帯に既に予約があります。重複予約はできません。' });
      }
    }
    const id = randomUUID();
    await pool.execute(
      `INSERT INTO \`Reservation\` (id, startAt, endAt, location, bandId, memo, userId)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, start, end, location, bandId || null, memo || null, req.session.userId],
    );
    const [rows] = await pool.query(
      `SELECT r.id, r.startAt, r.endAt, r.location, r.memo, r.userId, r.bandId,
              u.name AS userName, u.studentId AS userStudentId, u.iconPath AS userIconPath,
              b.name AS bandName
       FROM \`Reservation\` r
       INNER JOIN \`User\` u ON u.id = r.userId
       LEFT JOIN \`Band\` b ON b.id = r.bandId
       WHERE r.id = ?`,
      [id],
    );
    res.status(201).json({ reservation: mapReservationRow(rows[0]) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '予約に失敗しました' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const [prevRows] = await pool.query(
    `SELECT r.id, r.startAt, r.endAt, r.location, r.bandId, r.memo, r.userId,
            u.name AS userName, u.studentId AS userStudentId, u.iconPath AS userIconPath,
            b.name AS bandName
     FROM \`Reservation\` r
     INNER JOIN \`User\` u ON u.id = r.userId
     LEFT JOIN \`Band\` b ON b.id = r.bandId
     WHERE r.id = ?`,
    [id],
  );
  const reservation = prevRows[0];
  if (!reservation) return res.status(404).json({ error: '予約が見つかりません' });

  const now = new Date();
  const isAdmin = req.session.isAdmin;

  if (!isAdmin) {
    if (reservation.userId !== req.session.userId) {
      return res.status(403).json({ error: '他人の予約は編集できません' });
    }
    if (new Date(reservation.startAt) < now) {
      return res.status(403).json({ error: '過去の予約は編集できません' });
    }
  } else {
    const adminLimit = getAdminLimit(reservation.startAt);
    if (now > adminLimit) {
      return res.status(403).json({ error: '翌月末を過ぎた予約は編集できません' });
    }
  }

  const { startAt, endAt, location, bandId, memo } = req.body;
  let finalStart = new Date(reservation.startAt);
  let finalEnd = new Date(reservation.endAt);
  let finalLocation = reservation.location;
  let finalBandId = reservation.bandId;
  let finalMemo = reservation.memo;

  if (startAt != null) finalStart = new Date(startAt);
  if (endAt != null) finalEnd = new Date(endAt);
  if (location != null) finalLocation = location;
  if (bandId !== undefined) finalBandId = bandId || null;
  if (memo !== undefined) finalMemo = memo || null;

  if (finalLocation === 'ROOM_802_FRONT') {
    const [overlap] = await pool.query(
      `SELECT id FROM \`Reservation\`
       WHERE id != ? AND location = 'ROOM_802_FRONT' AND startAt < ? AND endAt > ? LIMIT 1`,
      [id, finalEnd, finalStart],
    );
    if (overlap.length) {
      return res.status(400).json({ error: '802前方はこの時間帯に既に予約があります。重複予約はできません。' });
    }
  }

  await pool.execute(
    `UPDATE \`Reservation\` SET startAt = ?, endAt = ?, location = ?, bandId = ?, memo = ? WHERE id = ?`,
    [finalStart, finalEnd, finalLocation, finalBandId, finalMemo, id],
  );

  const [rows] = await pool.query(
    `SELECT r.id, r.startAt, r.endAt, r.location, r.memo, r.userId, r.bandId,
            u.name AS userName, u.studentId AS userStudentId, u.iconPath AS userIconPath,
            b.name AS bandName
     FROM \`Reservation\` r
     INNER JOIN \`User\` u ON u.id = r.userId
     LEFT JOIN \`Band\` b ON b.id = r.bandId
     WHERE r.id = ?`,
    [id],
  );
  res.json({ reservation: mapReservationRow(rows[0]) });
});

router.delete('/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const [rows] = await pool.query(
    'SELECT id, userId, startAt FROM `Reservation` WHERE id = ?',
    [id],
  );
  const reservation = rows[0];
  if (!reservation) return res.status(404).json({ error: '予約が見つかりません' });

  const now = new Date();
  const isAdmin = req.session.isAdmin;

  if (!isAdmin) {
    if (reservation.userId !== req.session.userId) {
      return res.status(403).json({ error: '他人の予約は削除できません' });
    }
    if (new Date(reservation.startAt) < now) {
      return res.status(403).json({ error: '過去の予約は削除できません' });
    }
  } else {
    const adminLimit = getAdminLimit(reservation.startAt);
    if (now > adminLimit) {
      return res.status(403).json({ error: '翌月末を過ぎた予約は削除できません' });
    }
  }

  await pool.execute('DELETE FROM `Reservation` WHERE id = ?', [id]);
  res.json({ ok: true });
});

export default router;
