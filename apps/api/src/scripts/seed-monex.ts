import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

async function main() {
  console.log('[seed-monex] Starting seed...');

  // 1. Create Organization
  const org = await prisma.organization.create({
    data: {
      name: 'マネックス証券',
    },
  });
  console.log(`[seed-monex] Organization created: id=${org.id}, name=${org.name}`);

  // 2. Create Brand
  const brand = await prisma.brand.create({
    data: {
      organizationId: org.id,
      name: 'マネックス証券',
      domain: 'monex.co.jp',
      keywords: 'マネックス,マネックス証券,monex',
      whitelistDomains: 'monex.co.jp,monex.com,monex.jp',
    },
  });
  console.log(`[seed-monex] Brand created: id=${brand.id}, name=${brand.name}`);

  // 3. Create Users
  const users = [
    { email: 'kaneko@monex.co.jp', name: 'Kaneko', password: '$kaneko0000', role: 'admin' },
    { email: 'yorinobu_watanabe@monex.co.jp', name: 'Yorinobu Watanabe', password: '$watanabe0000', role: 'admin' },
    { email: 'yusuke@coincheck.com', name: 'Yusuke Otsuka', password: '$otsuka0000', role: 'admin' },
  ];

  for (const u of users) {
    const hashedPassword = await bcrypt.hash(u.password, 12);
    const user = await prisma.user.create({
      data: {
        email: u.email,
        hashedPassword,
        name: u.name,
        role: u.role,
        organizationId: org.id,
      },
    });
    console.log(`[seed-monex] User created: id=${user.id}, email=${user.email}, name=${user.name}`);
  }

  console.log('\n[seed-monex] === Summary ===');
  console.log(`  Organization ID: ${org.id}`);
  console.log(`  Organization:    ${org.name}`);
  console.log(`  Brand ID:        ${brand.id}`);
  console.log(`  Users created:   ${users.length}`);
  console.log('[seed-monex] Done.');
}

main()
  .catch((err) => {
    console.error('[seed-monex] Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
