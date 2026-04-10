import { Router } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { pool } from '../db.js';

const router = Router();

export async function fetchUserWithBands(userId) {
  const [users] = await pool.query(
    `SELECT u.id, u.name, u.studentId, u.email, u.iconPath, u.isAdmin, u.instruments
     FROM \`User\` u WHERE u.id = ? LIMIT 1`,
    [userId],
  );
  const user = users[0];
  if (!user) return null;
  const [bands] = await pool.query(
    `SELECT b.id, b.name, b.createdAt FROM \`Band\` b
     INNER JOIN \`UserBand\` ub ON ub.bandId = b.id WHERE ub.userId = ? ORDER BY b.name ASC`,
    [userId],
  );
  return {
    id: user.id,
    name: user.name,
    studentId: user.studentId,
    email: user.email,
    iconPath: user.iconPath,
    isAdmin: Boolean(user.isAdmin),
    instruments: JSON.parse(user.instruments),
    bands,
  };
}

function getTransportOptions() {
  if (process.env.SMTP_URL) return process.env.SMTP_URL;
  if (process.env.MAIL_APP_PASSWORD && process.env.MAIL_FROM) {
    return {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: false,
      auth: { user: process.env.MAIL_FROM, pass: process.env.MAIL_APP_PASSWORD },
    };
  }
  return { host: 'localhost', port: 1025, ignoreTLS: true };
}

const transporter = nodemailer.createTransport(getTransportOptions());

function sendResetEmail(to, code) {
  return transporter.sendMail({
    from: process.env.MAIL_FROM || 'koiuzmi3751@gmail.com',
    to,
    subject: '【バンド練習予約】パスワード再設定の認証コード',
    text: `認証コード: ${code}\nこのコードは一定時間で無効になります。`,
  });
}

router.post('/register', async (req, res) => {
  try {
    const { name, studentId, email, password, bandIds, instruments, iconPath } = req.body;
    if (!name || !studentId || !email || !password) {
      return res.status(400).json({ error: '名前・学籍番号・メール・パスワードは必須です' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'パスワードは6文字以上にしてください' });
    }
    const [dup] = await pool.query(
      'SELECT id FROM `User` WHERE studentId = ? OR email = ? LIMIT 1',
      [studentId, email],
    );
    if (dup.length) {
      return res.status(400).json({ error: '学籍番号またはメールアドレスは既に使用されています' });
    }
    const inst = Array.isArray(instruments) ? instruments : (instruments ? JSON.parse(instruments) : []);
    if (!inst.length) {
      return res.status(400).json({ error: '担当楽器を1つ以上選択してください' });
    }
    const hash = await bcrypt.hash(password, 10);
    const id = randomUUID();
    await pool.execute(
      `INSERT INTO \`User\` (id, name, studentId, email, passwordHash, iconPath, instruments)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, studentId, email, hash, iconPath || '', JSON.stringify(inst)],
    );
    if (bandIds && bandIds.length) {
      const values = bandIds.map((bandId) => [id, bandId]);
      await pool.query(
        'INSERT INTO `UserBand` (userId, bandId) VALUES ?',
        [values],
      );
    }
    req.session.userId = id;
    req.session.isAdmin = false;
    const withBands = await fetchUserWithBands(id);
    res.json({ user: withBands });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '登録に失敗しました' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { studentId, password, login } = req.body;
    const loginId = login ?? studentId;
    if (!loginId || !password) {
      return res.status(400).json({ error: '学籍番号（またはメール）とパスワードを入力してください' });
    }
    const isEmail = String(loginId).includes('@');
    const [rows] = await pool.query(
      isEmail
        ? `SELECT u.id, u.name, u.studentId, u.email, u.iconPath, u.isAdmin, u.passwordHash, u.instruments
           FROM \`User\` u WHERE u.email = ? LIMIT 1`
        : `SELECT u.id, u.name, u.studentId, u.email, u.iconPath, u.isAdmin, u.passwordHash, u.instruments
           FROM \`User\` u WHERE u.studentId = ? LIMIT 1`,
      [loginId],
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: '学籍番号（またはメール）またはパスワードが正しくありません' });
    }
    req.session.userId = user.id;
    req.session.isAdmin = Boolean(user.isAdmin);
    const [bands] = await pool.query(
      `SELECT b.id, b.name, b.createdAt FROM \`Band\` b
       INNER JOIN \`UserBand\` ub ON ub.bandId = b.id WHERE ub.userId = ? ORDER BY b.name ASC`,
      [user.id],
    );
    res.json({
      user: {
        id: user.id,
        name: user.name,
        studentId: user.studentId,
        email: user.email,
        iconPath: user.iconPath,
        isAdmin: Boolean(user.isAdmin),
        instruments: JSON.parse(user.instruments),
        bands,
      },
    });
  } catch (e) {
    console.error(e);
    const isDbError = e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT' || e.code === 'PROTOCOL_CONNECTION_LOST';
    res.status(isDbError ? 503 : 500).json({
      error: isDbError ? 'データベースに接続できません。サーバーを確認するか、しばらくしてからお試しください。' : 'ログインに失敗しました',
    });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

router.get('/me', async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: '未ログイン' });
  }
  const user = await fetchUserWithBands(req.session.userId);
  if (!user) return res.status(401).json({ error: 'ユーザーが見つかりません' });
  res.json({ user });
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'メールアドレスを入力してください' });
    const [rows] = await pool.query('SELECT id, email FROM `User` WHERE email = ? LIMIT 1', [email]);
    const user = rows[0];
    if (!user) {
      return res.json({ message: '該当するメールアドレスに認証コードを送信しました' });
    }
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const prId = randomUUID();
    await pool.execute(
      `INSERT INTO \`PasswordReset\` (id, email, code, expiresAt, userId)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE email = VALUES(email), code = VALUES(code), expiresAt = VALUES(expiresAt)`,
      [prId, email, code, expiresAt, user.id],
    );
    try {
      await sendResetEmail(user.email, code);
    } catch (mailErr) {
      console.error('メール送信エラー:', mailErr.message);
      if (process.env.NODE_ENV !== 'production') {
        console.log('【開発用】認証コード:', code, '（15分間有効）');
        return res.json({ message: '認証コードを送信しました。SMTP未設定のため、サーバーのターミナルに表示されたコードを入力してください。' });
      }
      return res.status(500).json({ error: '送信に失敗しました。しばらくしてから再度お試しください。' });
    }
    res.json({ message: '認証コードを送信しました' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '送信に失敗しました' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'メール・認証コード・新しいパスワードは必須です' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'パスワードは6文字以上にしてください' });
    }
    const [resets] = await pool.query(
      `SELECT pr.id, pr.userId, pr.expiresAt FROM \`PasswordReset\` pr
       WHERE pr.email = ? AND pr.code = ? LIMIT 1`,
      [email, code],
    );
    const reset = resets[0];
    if (!reset || new Date(reset.expiresAt) < new Date()) {
      return res.status(400).json({ error: '認証コードが無効または期限切れです' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE `User` SET passwordHash = ? WHERE id = ?', [hash, reset.userId]);
    await pool.execute('DELETE FROM `PasswordReset` WHERE id = ?', [reset.id]);
    res.json({ message: 'パスワードを再設定しました' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '再設定に失敗しました' });
  }
});

export default router;
