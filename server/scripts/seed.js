import '../src/env.js';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const SAMPLE_BAND_ID = '00000000-0000-4000-8000-000000000002';

async function main() {
  const hash = await bcrypt.hash('password', 10);
  await pool.execute(
    `INSERT INTO \`User\` (id, name, studentId, email, passwordHash, iconPath, isAdmin, instruments)
     VALUES (?, ?, ?, ?, ?, ?, TRUE, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [ADMIN_ID, '管理者', '00admin', 'koiuzmi3751@gmail.com', hash, '/uploads/default-avatar.png', '["Vo"]'],
  );

  const [bands] = await pool.query('SELECT id FROM `Band` WHERE name = ? LIMIT 1', ['サンプルバンド']);
  if (!bands.length) {
    await pool.execute('INSERT INTO `Band` (id, name) VALUES (?, ?)', [SAMPLE_BAND_ID, 'サンプルバンド']);
  }
  console.log('Seed done: admin studentId=00admin, sample band=サンプルバンド');
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
