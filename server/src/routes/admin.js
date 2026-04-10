import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAdmin);

router.get('/users', async (req, res) => {
  const [users] = await pool.query(
    `SELECT id, name, studentId, email, iconPath, isAdmin FROM \`User\` ORDER BY studentId ASC`,
  );
  res.json({ users });
});

router.get('/users/search', async (req, res) => {
  const { studentId } = req.query;
  if (!studentId || String(studentId).length < 2) {
    return res.status(400).json({ error: '学籍番号を2桁以上入力してください' });
  }
  const like = `%${String(studentId)}%`;
  const [users] = await pool.query(
    `SELECT id, name, studentId, email, iconPath, isAdmin FROM \`User\` WHERE studentId LIKE ? ORDER BY studentId ASC`,
    [like],
  );
  res.json({ users });
});

router.post('/users/:id/grant-admin', async (req, res) => {
  const { id } = req.params;
  const [rows] = await pool.query(
    'SELECT id, name, studentId, isAdmin FROM `User` WHERE id = ? LIMIT 1',
    [id],
  );
  const user = rows[0];
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  if (user.isAdmin) return res.status(400).json({ error: '既に管理者です' });
  await pool.execute('UPDATE `User` SET isAdmin = TRUE WHERE id = ?', [id]);
  res.json({ message: '管理者権限を付与しました', user: { ...user, isAdmin: true } });
});

router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  if (id === req.session.userId) {
    return res.status(400).json({ error: '自分自身を削除することはできません' });
  }
  const [result] = await pool.execute('DELETE FROM `User` WHERE id = ?', [id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  res.json({ ok: true });
});

router.get('/users/bulk-preview', async (req, res) => {
  const { prefix } = req.query;
  if (!prefix || String(prefix).length < 2) {
    return res.status(400).json({ error: '学籍番号の上2桁以上を指定してください' });
  }
  const p = `${String(prefix)}%`;
  const [users] = await pool.query(
    'SELECT id, name, studentId, iconPath FROM `User` WHERE studentId LIKE ? ORDER BY studentId ASC',
    [p],
  );
  res.json({ users, count: users.length });
});

router.post('/users/bulk-delete', async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || !userIds.length) {
    return res.status(400).json({ error: '削除対象ユーザーを指定してください' });
  }
  if (userIds.includes(req.session.userId)) {
    return res.status(400).json({ error: '自分自身を削除対象に含めることはできません' });
  }
  const placeholders = userIds.map(() => '?').join(',');
  await pool.query(`DELETE FROM \`User\` WHERE id IN (${placeholders})`, userIds);
  res.json({ ok: true, deleted: userIds.length });
});

router.get('/circle-fees', async (req, res) => {
  const now = new Date();
  const queryYear = Number(req.query.fiscalYear);
  const fiscalYear = Number.isInteger(queryYear) ? queryYear : now.getFullYear();

  const [users] = await pool.query(
    'SELECT id, name, studentId FROM `User` ORDER BY studentId ASC',
  );
  const [feeRows] = await pool.query(
    'SELECT userId, springPaid, autumnPaid FROM `CircleFeeStatus` WHERE fiscalYear = ?',
    [fiscalYear],
  );
  const feeMap = new Map(feeRows.map((row) => [row.userId, row]));

  const checklist = users.map((user) => {
    const row = feeMap.get(user.id);
    return {
      userId: user.id,
      name: user.name,
      studentId: user.studentId,
      springPaid: Boolean(row?.springPaid),
      autumnPaid: Boolean(row?.autumnPaid),
    };
  });

  res.json({ fiscalYear, checklist });
});

router.patch('/circle-fees/:userId', async (req, res) => {
  const { userId } = req.params;
  const { fiscalYear, springPaid, autumnPaid } = req.body;

  if (!Number.isInteger(fiscalYear)) {
    return res.status(400).json({ error: '年度が不正です' });
  }

  const [urows] = await pool.query('SELECT id FROM `User` WHERE id = ? LIMIT 1', [userId]);
  if (!urows.length) return res.status(404).json({ error: 'ユーザーが見つかりません' });

  const data = {};
  if (typeof springPaid === 'boolean') data.springPaid = springPaid;
  if (typeof autumnPaid === 'boolean') data.autumnPaid = autumnPaid;
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: '更新項目がありません' });
  }

  const [existing] = await pool.query(
    'SELECT id, springPaid, autumnPaid FROM `CircleFeeStatus` WHERE userId = ? AND fiscalYear = ? LIMIT 1',
    [userId, fiscalYear],
  );

  let status;
  if (existing.length) {
    const cur = existing[0];
    const sp = typeof springPaid === 'boolean' ? springPaid : Boolean(cur.springPaid);
    const ap = typeof autumnPaid === 'boolean' ? autumnPaid : Boolean(cur.autumnPaid);
    await pool.execute(
      'UPDATE `CircleFeeStatus` SET springPaid = ?, autumnPaid = ? WHERE id = ?',
      [sp, ap, cur.id],
    );
    status = { userId, fiscalYear, springPaid: sp, autumnPaid: ap };
  } else {
    const sp = typeof springPaid === 'boolean' ? springPaid : false;
    const ap = typeof autumnPaid === 'boolean' ? autumnPaid : false;
    await pool.execute(
      'INSERT INTO `CircleFeeStatus` (id, userId, fiscalYear, springPaid, autumnPaid) VALUES (?, ?, ?, ?, ?)',
      [randomUUID(), userId, fiscalYear, sp, ap],
    );
    status = { userId, fiscalYear, springPaid: sp, autumnPaid: ap };
  }

  res.json({ status });
});

export default router;
