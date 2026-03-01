import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    where: { email: 'admin@brandshield.com' },
    data: { role: 'superadmin' },
  });
  console.log(`Updated ${result.count} user(s) to superadmin role`);

  const user = await prisma.user.findUnique({
    where: { email: 'admin@brandshield.com' },
    select: { id: true, email: true, role: true },
  });
  console.log('Verified:', user);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
