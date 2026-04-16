import './env.js';
import { pingDb } from './db.js';

import path from 'path';
import { fileURLToPath } from 'url';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import bandRoutes from './routes/bands.js';
import reservationRoutes from './routes/reservations.js';
import rankingRoutes from './routes/ranking.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
  console.warn('DATABASE_URL または DB_* が未設定です。server/.env を確認してください。');
}

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3001;

// Nginx の後ろで動かすため
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

const isHttps = process.env.APP_ENV === 'https';

app.use(session({
  secret: process.env.SESSION_SECRET || 'band-practice-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: isHttps,        // 今は HTTP 公開なので false にする
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

const uploadsPath = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bands', bandRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/ranking', rankingRoutes);
app.use('/api/admin', adminRoutes);

async function start() {
  try {
    await pingDb();
    console.log('Database connected.');
  } catch (e) {
    console.error('Database connection failed:', e.message);
    console.error('DATABASE_URL:', process.env.DATABASE_URL);
    console.error('対処: MySQL 起動後、初回は server/sql/init を docker-entrypoint-initdb.d にマウントするか、手動でスキーマを流し込んでください。');
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nポート ${PORT} は既に使用中です。`);
      console.error('別のターミナルで次のいずれかを実行してから再度 npm run dev を実行してください:');
      console.error('  npx kill-port 3001');
      console.error('  または: taskkill /F /IM node.exe (すべての Node を終了)\n');
      process.exit(1);
    }
    throw err;
  });
}

start();
