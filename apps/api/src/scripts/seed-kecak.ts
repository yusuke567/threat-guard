import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

async function main() {
  console.log('[seed-kecak] Starting seed...');

  // 1. Create Organization
  const org = await prisma.organization.create({
    data: {
      name: '株式会社KECAK',
    },
  });
  console.log(`[seed-kecak] Organization created: id=${org.id}, name=${org.name}`);

  // 2. Create Brand
  const brand = await prisma.brand.create({
    data: {
      organizationId: org.id,
      name: 'オリパワン',
      domain: 'oripaone.com',
      keywords: 'オリパワン,KECAK,oripaone,kecak',
      whitelistDomains:
        'oripaone.com,oripaone.net,oripaone.jp.net,kecak.co.jp,oripaone.site,oripaone.shop,oripaone.info,oripaone.online,oripaone.inc,oripaone.jp,kecak.jp',
    },
  });
  console.log(`[seed-kecak] Brand created: id=${brand.id}, name=${brand.name}`);

  // 3. Create User (admin)
  const hashedPassword = await bcrypt.hash('kecak-admin-2026', 12);
  const user = await prisma.user.create({
    data: {
      email: 'admin@kecak.co.jp',
      hashedPassword,
      name: 'KECAK Admin',
      role: 'admin',
      organizationId: org.id,
    },
  });
  console.log(`[seed-kecak] User created: id=${user.id}, email=${user.email}`);

  console.log('\n[seed-kecak] === Summary ===');
  console.log(`  Organization ID: ${org.id}`);
  console.log(`  Brand ID:        ${brand.id}`);
  console.log(`  User ID:         ${user.id}`);
  console.log('[seed-kecak] Done.');
}

main()
  .catch((err) => {
    console.error('[seed-kecak] Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
