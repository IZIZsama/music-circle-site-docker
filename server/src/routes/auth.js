import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

const prisma = new PrismaClient();
const router = Router();

// Gmail: SMTP_URL の代わりに MAIL_APP_PASSWORD を使うとパスワードの記号を気にしなくてよい
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

// 登録
router.post('/register', async (req, res) => {
  try {
    const { name, studentId, email, password, bandIds, instruments, iconPath } = req.body;
    if (!name || !studentId || !email || !password) {
      return res.status(400).json({ error: '名前・学籍番号・メール・パスワードは必須です' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'パスワードは6文字以上にしてください' });
    }
    const existing = await prisma.user.findFirst({
      where: { OR: [{ studentId }, { email }] },
    });
    if (existing) {
      return res.status(400).json({ error: '学籍番号またはメールアドレスは既に使用されています' });
    }
    const inst = Array.isArray(instruments) ? instruments : (instruments ? JSON.parse(instruments) : []);
    if (!inst.length) {
      return res.status(400).json({ error: '担当楽器を1つ以上選択してください' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        studentId,
        email,
        passwordHash: hash,
        iconPath: iconPath || '',
        instruments: JSON.stringify(inst),
      },
    });
    if (bandIds && bandIds.length) {
      await prisma.userBand.createMany({
        data: bandIds.map((bandId) => ({ userId: user.id, bandId })),
      });
    }
    req.session.userId = user.id;
    req.session.isAdmin = user.isAdmin;
    const withBands = await prisma.user.findUnique({
      where: { id: user.id },
      include: { bands: { include: { band: true } } },
    });
    res.json({
      user: {
        id: withBands.id,
        name: withBands.name,
        studentId: withBands.studentId,
        email: withBands.email,
        iconPath: withBands.iconPath,
        isAdmin: withBands.isAdmin,
        instruments: JSON.parse(withBands.instruments),
        bands: withBands.bands.map((ub) => ub.band),
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '登録に失敗しました' });
  }
});

// ログイン（学籍番号またはメールアドレス + パスワード）
router.post('/login', async (req, res) => {
  try {
    const { studentId, password, login } = req.body;
    const loginId = login ?? studentId;
    if (!loginId || !password) {
      return res.status(400).json({ error: '学籍番号（またはメール）とパスワードを入力してください' });
    }
    const isEmail = String(loginId).includes('@');
    const user = await prisma.user.findFirst({
      where: isEmail ? { email: loginId } : { studentId: loginId },
      include: { bands: { include: { band: true } } },
    });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: '学籍番号（またはメール）またはパスワードが正しくありません' });
    }
    req.session.userId = user.id;
    req.session.isAdmin = user.isAdmin;
    res.json({
      user: {
        id: user.id,
        name: user.name,
        studentId: user.studentId,
        email: user.email,
        iconPath: user.iconPath,
        isAdmin: user.isAdmin,
        instruments: JSON.parse(user.instruments),
        bands: user.bands.map((ub) => ub.band),
      },
    });
  } catch (e) {
    console.error(e);
    const isDbError = e.code === 'P1001' || e.code === 'P1002' || e.message?.includes('SQLITE');
    res.status(isDbError ? 503 : 500).json({
      error: isDbError ? 'データベースに接続できません。サーバーを確認するか、しばらくしてからお試しください。' : 'ログインに失敗しました',
    });
  }
});

// ログアウト
router.post('/logout', (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

// 現在ユーザー
router.get('/me', async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: '未ログイン' });
  }
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    include: { bands: { include: { band: true } } },
  });
  if (!user) return res.status(401).json({ error: 'ユーザーが見つかりません' });
  res.json({
    user: {
      id: user.id,
      name: user.name,
      studentId: user.studentId,
      email: user.email,
      iconPath: user.iconPath,
      isAdmin: user.isAdmin,
      instruments: JSON.parse(user.instruments),
      bands: user.bands.map((ub) => ub.band),
    },
  });
});

// パスワード忘れ: 認証コード送信
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'メールアドレスを入力してください' });
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: '該当するメールアドレスに認証コードを送信しました' });
    }
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.passwordReset.upsert({
      where: { userId: user.id },
      create: { email, code, expiresAt, userId: user.id },
      update: { code, expiresAt },
    });
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

// 認証コード確認 & パスワード再設定
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'メール・認証コード・新しいパスワードは必須です' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'パスワードは6文字以上にしてください' });
    }
    const reset = await prisma.passwordReset.findFirst({
      where: { email, code },
      include: { user: true },
    });
    if (!reset || reset.expiresAt < new Date()) {
      return res.status(400).json({ error: '認証コードが無効または期限切れです' });
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: hash },
    });
    await prisma.passwordReset.delete({ where: { id: reset.id } });
    res.json({ message: 'パスワードを再設定しました' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '再設定に失敗しました' });
  }
});

export default router;
