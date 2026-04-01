import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('password', 10);
  const admin = await prisma.user.upsert({
    where: { studentId: '00admin' },
    update: {},
    create: {
      name: '管理者',
      studentId: '00admin',
      email: 'koiuzmi3751@gmail.com',
      passwordHash: hash,
      iconPath: '/uploads/default-avatar.png',
      isAdmin: true,
      instruments: '["Vo"]',
    },
  });
  let band = await prisma.band.findFirst({ where: { name: 'サンプルバンド' } });
  if (!band) {
    band = await prisma.band.create({ data: { name: 'サンプルバンド' } });
  }
  console.log('Seed done:', { admin: admin.studentId, band: band.name });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
