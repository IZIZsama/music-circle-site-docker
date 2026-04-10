import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import fs from 'fs';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { fetchUserWithBands } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

function safeUnlink(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    if (err.code !== 'EPERM' && err.code !== 'EBUSY') console.error('safeUnlink:', err);
  }
}

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

router.get('/me', async (req, res) => {
  const user = await fetchUserWithBands(req.session.userId);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  res.json({
    id: user.id,
    name: user.name,
    studentId: user.studentId,
    email: user.email,
    iconPath: user.iconPath,
    isAdmin: user.isAdmin,
    instruments: user.instruments,
    bands: user.bands,
  });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  if (id === 'me') return res.status(400).json({ error: 'Use GET /me for own profile' });
  const user = await fetchUserWithBands(id);
  if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });
  res.json({
    id: user.id,
    name: user.name,
    studentId: user.studentId,
    iconPath: user.iconPath,
    instruments: user.instruments,
    bands: user.bands,
  });
});

router.patch('/me', async (req, res) => {
  const { name, email, bandIds, instruments, iconPath } = req.body;
  const updates = [];
  const params = [];

  if (name != null) {
    updates.push('name = ?');
    params.push(name);
  }
  if (email != null) {
    const [existing] = await pool.query(
      'SELECT id FROM `User` WHERE email = ? AND id != ? LIMIT 1',
      [email, req.session.userId],
    );
    if (existing.length) return res.status(400).json({ error: 'このメールアドレスは既に使用されています' });
    updates.push('email = ?');
    params.push(email);
  }
  if (iconPath != null) {
    updates.push('iconPath = ?');
    params.push(iconPath);
  }
  if (instruments != null) {
    const inst = Array.isArray(instruments) ? instruments : JSON.parse(instruments);
    if (!inst.length) return res.status(400).json({ error: '担当楽器を1つ以上選択してください' });
    updates.push('instruments = ?');
    params.push(JSON.stringify(inst));
  }

  if (updates.length) {
    params.push(req.session.userId);
    await pool.query(`UPDATE \`User\` SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  if (bandIds != null) {
    await pool.execute('DELETE FROM `UserBand` WHERE userId = ?', [req.session.userId]);
    if (bandIds.length) {
      const values = bandIds.map((bandId) => [req.session.userId, bandId]);
      await pool.query('INSERT INTO `UserBand` (userId, bandId) VALUES ?', [values]);
    }
    const updated = await fetchUserWithBands(req.session.userId);
    return res.json({
      id: updated.id,
      name: updated.name,
      studentId: updated.studentId,
      email: updated.email,
      iconPath: updated.iconPath,
      isAdmin: updated.isAdmin,
      instruments: updated.instruments,
      bands: updated.bands,
    });
  }

  const user = await fetchUserWithBands(req.session.userId);
  res.json({
    id: user.id,
    name: user.name,
    studentId: user.studentId,
    email: user.email,
    iconPath: user.iconPath,
    isAdmin: user.isAdmin,
    instruments: user.instruments,
    bands: user.bands,
  });
});

export default router;
