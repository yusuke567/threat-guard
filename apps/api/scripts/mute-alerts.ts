/**
 * Temporarily mute email/slack alerts for specified brand recipients by
 * setting User.alertEnabled=false. Writes a JSON backup of the original
 * state so it can be restored with --restore.
 *
 * Use case: before running a large backfill re-analysis (e.g. the
 * reset-stuck-analyzing rescue) to avoid flooding recipients with thousands
 * of alerts at once.
 *
 * Usage:
 *   # Dry-run (show what would be muted, no DB changes)
 *   npx tsx scripts/mute-alerts.ts
 *
 *   # Actually mute (writes backup to scripts/.alerts-backup.json)
 *   npx tsx scripts/mute-alerts.ts --apply
 *
 *   # Restore from backup
 *   npx tsx scripts/mute-alerts.ts --restore
 *
 * By default targets brands: マネックス証券 / Coincheck / オリパワン.
 * Override with: --brands "BrandA,BrandB"
 */
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();

const BACKUP_PATH = path.resolve(process.cwd(), 'scripts', '.alerts-backup.json');
const DEFAULT_BRANDS = ['マネックス証券', 'Coincheck', 'オリパワン'];

interface BackupEntry {
  userId: string;
  email: string;
  previousAlertEnabled: boolean;
  brandName: string;
  orgId: string;
  mutedAt: string;
}

async function resolveTargetUsers(brandNames: string[]) {
  const brands = await prisma.brand.findMany({
    where: { name: { in: brandNames } },
    select: { id: true, name: true, organizationId: true },
  });
  const orgIds = Array.from(new Set(brands.map((b) => b.organizationId).filter((x): x is string => !!x)));

  const users = await prisma.user.findMany({
    where: {
      organizationId: { in: orgIds },
      alertEnabled: true,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      alertEnabled: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
    orderBy: { email: 'asc' },
  });

  // Pick one brand name per org for labeling in the backup
  const orgToBrandName = new Map<string, string>();
  for (const b of brands) {
    if (b.organizationId && !orgToBrandName.has(b.organizationId)) {
      orgToBrandName.set(b.organizationId, b.name);
    }
  }

  return { brands, users, orgToBrandName };
}

async function mute(brandNames: string[], apply: boolean) {
  const { users, orgToBrandName } = await resolveTargetUsers(brandNames);

  console.log(`[mute-alerts] 対象ブランド: ${brandNames.join(', ')}`);
  console.log(`[mute-alerts] 通知ON のユーザー: ${users.length}名`);
  for (const u of users) {
    console.log(`  - ${u.email} (${u.name ?? '-'}) / org=${u.organization?.name}`);
  }

  if (!apply) {
    console.log('\n[dry-run] --apply で実際にミュートします。バックアップは scripts/.alerts-backup.json に保存。');
    return;
  }

  // Avoid accidentally overwriting a live backup
  try {
    await fs.access(BACKUP_PATH);
    console.error(`\n[mute-alerts] 既存のバックアップが存在します: ${BACKUP_PATH}`);
    console.error('先に --restore で復旧するか、手動で削除してください。多重適用を防ぐため処理を中断しました。');
    process.exit(1);
  } catch {
    // no existing backup — ok to proceed
  }

  const backup: BackupEntry[] = users.map((u) => ({
    userId: u.id,
    email: u.email,
    previousAlertEnabled: u.alertEnabled,
    brandName: u.organizationId ? (orgToBrandName.get(u.organizationId) ?? '') : '',
    orgId: u.organizationId ?? '',
    mutedAt: new Date().toISOString(),
  }));

  await fs.writeFile(BACKUP_PATH, JSON.stringify(backup, null, 2), 'utf-8');
  console.log(`\n[mute-alerts] バックアップ保存: ${BACKUP_PATH}`);

  const result = await prisma.user.updateMany({
    where: { id: { in: users.map((u) => u.id) } },
    data: { alertEnabled: false },
  });
  console.log(`[mute-alerts] ${result.count}名の alertEnabled を false に設定しました。`);
}

async function restore() {
  let raw: string;
  try {
    raw = await fs.readFile(BACKUP_PATH, 'utf-8');
  } catch {
    console.error(`[mute-alerts] バックアップが見つかりません: ${BACKUP_PATH}`);
    process.exit(1);
  }
  const backup: BackupEntry[] = JSON.parse(raw);

  console.log(`[mute-alerts] ${backup.length}名の alertEnabled を復旧します`);
  let restored = 0;
  for (const entry of backup) {
    await prisma.user.update({
      where: { id: entry.userId },
      data: { alertEnabled: entry.previousAlertEnabled },
    });
    restored++;
    console.log(`  - ${entry.email} → alertEnabled=${entry.previousAlertEnabled}`);
  }
  console.log(`\n[mute-alerts] ${restored}名を復旧しました。`);

  // Archive the backup so it can't be replayed accidentally
  const archived = BACKUP_PATH.replace(/\.json$/, `.${Date.now()}.json`);
  await fs.rename(BACKUP_PATH, archived);
  console.log(`[mute-alerts] バックアップをアーカイブ: ${path.basename(archived)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const doRestore = args.includes('--restore');

  const brandIdx = args.indexOf('--brands');
  const brandNames =
    brandIdx >= 0 && args[brandIdx + 1]
      ? args[brandIdx + 1].split(',').map((s) => s.trim()).filter(Boolean)
      : DEFAULT_BRANDS;

  if (doRestore) {
    await restore();
  } else {
    await mute(brandNames, apply);
  }
}

main()
  .catch((err) => {
    console.error('[mute-alerts] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
