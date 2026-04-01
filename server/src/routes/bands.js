import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = Router();

// 一覧（ログイン不要でバンド名だけ取得する用は使わず、予約時に「自分の所属バンド」と「全バンド」を返すのでここでは認証必須で）
router.get('/', requireAuth, async (req, res) => {
  const bands = await prisma.band.findMany({
    orderBy: { name: 'asc' },
  });
  res.json({ bands });
});

// 管理者: バンド作成
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'バンド名は必須です' });
  }
  const band = await prisma.band.create({
    data: { name: String(name).trim() },
  });
  res.json({ band });
});

// 管理者: バンド削除（物理削除）
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  await prisma.band.delete({
    where: { id: req.params.id },
  });
  res.json({ ok: true });
});

export default router;
