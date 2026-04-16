import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const brandNames = ['マネックス証券', 'Coincheck', 'オリパワン'];

  for (const name of brandNames) {
    const brand = await prisma.brand.findFirst({
      where: { name },
      select: {
        id: true,
        name: true,
        organizationId: true,
        organization: { select: { name: true } },
      },
    });
    if (!brand) {
      console.log(`\n[${name}] ブランドが見つかりません`);
      continue;
    }

    const recipients = await prisma.user.findMany({
      where: {
        organizationId: brand.organizationId,
        alertEnabled: true,
        deletedAt: null,
      },
      select: { email: true, name: true, alertThreshold: true, role: true },
      orderBy: { alertThreshold: 'asc' },
    });

    const disabled = await prisma.user.findMany({
      where: {
        organizationId: brand.organizationId,
        alertEnabled: false,
        deletedAt: null,
      },
      select: { email: true, name: true, role: true },
    });

    console.log(`\n=== ${brand.name} (org: ${brand.organization?.name}) ===`);
    console.log(`通知対象ユーザー: ${recipients.length}名`);
    for (const u of recipients) {
      console.log(
        `  - ${u.email} (${u.name ?? '-'}) / role=${u.role} / threshold=${u.alertThreshold}`
      );
    }
    if (disabled.length > 0) {
      console.log(`通知オフ: ${disabled.length}名`);
      for (const u of disabled) {
        console.log(`  - ${u.email} (${u.name ?? '-'})`);
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
