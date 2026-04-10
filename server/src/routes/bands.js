import { Router } from 'express';
import { randomUUID } from 'crypto';
import { pool } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const [bands] = await pool.query(
    'SELECT id, name, createdAt FROM `Band` ORDER BY name ASC',
  );
  res.json({ bands });
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'バンド名は必須です' });
  }
  const id = randomUUID();
  await pool.execute('INSERT INTO `Band` (id, name) VALUES (?, ?)', [id, String(name).trim()]);
  const [rows] = await pool.query('SELECT id, name, createdAt FROM `Band` WHERE id = ?', [id]);
  res.json({ band: rows[0] });
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const [result] = await pool.execute('DELETE FROM `Band` WHERE id = ?', [req.params.id]);
  if (result.affectedRows === 0) {
    return res.status(404).json({ error: 'バンドが見つかりません' });
  }
  res.json({ ok: true });
});

export default router;
