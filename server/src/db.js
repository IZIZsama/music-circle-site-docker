import mysql from 'mysql2/promise';

function resolveConfig() {
  const urlStr = process.env.DATABASE_URL;
  if (urlStr) {
    try {
      const u = new URL(urlStr);
      const database = u.pathname.replace(/^\//, '').split('?')[0];
      return {
        host: u.hostname,
        port: Number(u.port) || 3306,
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database,
      };
    } catch (e) {
      console.warn('DATABASE_URL の解析に失敗しました:', e.message);
    }
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'band_practice',
    port: Number(process.env.DB_PORT) || 3306,
  };
}

export const pool = mysql.createPool({
  ...resolveConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export async function pingDb() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}
