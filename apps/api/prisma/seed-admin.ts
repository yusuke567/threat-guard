import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@threatguard.com';
  const password = 'threatguard2024';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log('Admin user already exists');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, hashedPassword, name: '管理者' },
  });

  console.log('✅ Admin user created');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   ID: ${user.id}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
