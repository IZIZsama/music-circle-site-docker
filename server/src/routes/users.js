import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
const router = Router();
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `icon-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname) || '.jpg'}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(png|jpg|jpeg)$/i.test(file.originalname);
    cb(null, ok);
  },
});

function ensureUploadsDir() {
  const dir = path.resolve(uploadsDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Windows でファイルロック中に unlink すると EPERM になるため、失敗しても握りつぶす
function safeUnlink(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    if (err.code !== 'EPERM' && err.code !== 'EBUSY') console.error('safeUnlink:', err);
  }
}

// アイコンアップロード（登録用・更新用）: 保存時に圧縮・リサイズ（失敗時は原寸のまま保存）
router.post('/upload-icon', (req, res, next) => {
  upload.single('icon')(req, res, (err) => {
    if (err) {
      console.error('Multer upload error:', err);
      return res.status(500).json({ error: err.message || 'ファイルのアップロードに失敗しました' });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '画像を選択してください' });

    const dir = ensureUploadsDir();
    const srcPath = path.resolve(req.file.path);
    const baseName = `icon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const outFileName = `${baseName}.jpg`;
    const outPath = path.resolve(dir, outFileName);

    try {
      await sharp(srcPath)
        .resize(400, 400, { fit: 'cover' })
        .jpeg({ quality: 85 })
        .toFile(outPath);
      safeUnlink(srcPath);
      return res.json({ iconPath: '/uploads/' + outFileName });
    } catch (e) {
      console.error('Icon resize error:', e);
      const ext = path.extname(req.file.originalname) || '.jpg';
      const fallbackFileName = baseName + ext;
      const fallbackPath = path.resolve(dir, fallbackFileName);
      fs.copyFileSync(srcPath, fallbackPath);
      safeUnlink(srcPath);
      return res.json({ iconPath: '/uploads/' + fallbackFileName });
    }
  } catch (e) {
    console.error('Upload-icon handler error:', e);
    res.status(500).json({ error: '画像の処理に失敗しました。別の画像（PNG/JPEG）でお試しください。' });
  }
});

router.use(requireAuth);

// プロフィール取得（自分）
router.get('/me', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    include: { bands: { include: { band: true } } },
  });
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  res.json({
    id: user.id,
    name: user.name,
    studentId: user.studentId,
    email: user.email,
    iconPath: user.iconPath,
    isAdmin: user.isAdmin,
    instruments: JSON.parse(user.instruments),
    bands: user.bands.map((ub) => ub.band),
  });
});

// 他ユーザーのプロフィール取得（閲覧用・公開情報のみ）
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (id === 'me') return res.status(400).json({ error: 'Use GET /me for own profile' });
  const user = await prisma.user.findUnique({
    where: { id },
    include: { bands: { include: { band: true } } },
  });
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  res.json({
    id: user.id,
    name: user.name,
    studentId: user.studentId,
    iconPath: user.iconPath,
    instruments: JSON.parse(user.instruments),
    bands: user.bands.map((ub) => ub.band),
  });
});

// プロフィール更新
router.patch('/me', async (req, res) => {
  const { name, email, bandIds, instruments, iconPath } = req.body;
  const data = {};
  if (name != null) data.name = name;
  if (email != null) {
    const existing = await prisma.user.findFirst({
      where: { email, id: { not: req.session.userId } },
    });
    if (existing) return res.status(400).json({ error: 'このメールアドレスは既に使用されています' });
    data.email = email;
  }
  if (iconPath != null) data.iconPath = iconPath;
  if (instruments != null) {
    const inst = Array.isArray(instruments) ? instruments : JSON.parse(instruments);
    if (!inst.length) return res.status(400).json({ error: '担当楽器を1つ以上選択してください' });
    data.instruments = JSON.stringify(inst);
  }
  const user = await prisma.user.update({
    where: { id: req.session.userId },
    data,
    include: { bands: { include: { band: true } } },
  });
  if (bandIds != null) {
    await prisma.userBand.deleteMany({ where: { userId: req.session.userId } });
    if (bandIds.length) {
      await prisma.userBand.createMany({
        data: bandIds.map((bandId) => ({ userId: req.session.userId, bandId })),
      });
    }
    const updated = await prisma.user.findUnique({
      where: { id: req.session.userId },
      include: { bands: { include: { band: true } } },
    });
    return res.json({
      id: updated.id,
      name: updated.name,
      studentId: updated.studentId,
      email: updated.email,
      iconPath: updated.iconPath,
      isAdmin: updated.isAdmin,
      instruments: JSON.parse(updated.instruments),
      bands: updated.bands.map((ub) => ub.band),
    });
  }
  res.json({
    id: user.id,
    name: user.name,
    studentId: user.studentId,
    email: user.email,
    iconPath: user.iconPath,
    isAdmin: user.isAdmin,
    instruments: JSON.parse(user.instruments),
    bands: user.bands.map((ub) => ub.band),
  });
});

export default router;
