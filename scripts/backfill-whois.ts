/**
 * 既存DetectedDomainのwhoisDataがnullのレコードに対して
 * RDAP経由でWHOISデータを一括取得・補完するスクリプト。
 *
 * Usage:
 *   cd apps/api && npx tsx ../../scripts/backfill-whois.ts
 *
 * Options:
 *   BATCH_SIZE=20       1バッチあたりの処理件数（デフォルト: 20）
 *   DELAY_MS=2000       リクエスト間の待機時間ms（デフォルト: 2000）
 *   DRY_RUN=1           実行内容のプレビューのみ（DB更新しない）
 */
import { PrismaClient } from '@prisma/client';
import { getDomain } from 'tldts';

const prisma = new PrismaClient();

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '20', 10);
const DELAY_MS = parseInt(process.env.DELAY_MS || '2000', 10);
const DRY_RUN = process.env.DRY_RUN === '1';

function extractRegistrableDomain(domain: string): string {
  return getDomain(domain) ?? domain;
}

async function fetchRdap(domain: string): Promise<Record<string, unknown> | null> {
  const baseDomain = extractRegistrableDomain(domain);
  const url = `https://rdap.org/domain/${baseDomain}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/rdap+json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) return null;
  const data = await res.json();

  let registrar = 'Unknown';
  let abuseEmail: string | null = null;
  let creationDate: string | null = null;
  let expirationDate: string | null = null;
  const nameServers: string[] = [];

  if (data.entities) {
    for (const entity of data.entities) {
      const roles: string[] = entity.roles || [];
      if (roles.includes('registrar')) {
        if (entity.vcardArray?.[1]) {
          for (const field of entity.vcardArray[1]) {
            if (field[0] === 'fn') registrar = field[3];
          }
        }
        if (registrar === 'Unknown' && entity.handle) registrar = entity.handle;
        if (entity.entities) {
          for (const sub of entity.entities) {
            if ((sub.roles || []).includes('abuse') && sub.vcardArray?.[1]) {
              for (const field of sub.vcardArray[1]) {
                if (field[0] === 'email') abuseEmail = field[3];
              }
            }
          }
        }
      }
      if (roles.includes('abuse') && entity.vcardArray?.[1]) {
        for (const field of entity.vcardArray[1]) {
          if (field[0] === 'email') abuseEmail = field[3];
        }
      }
    }
  }

  if (!abuseEmail && data.remarks) {
    for (const remark of data.remarks) {
      const desc = (remark.description || []).join(' ');
      const match = desc.match(/[\w.+-]+@[\w.-]+\.\w+/);
      if (match && desc.toLowerCase().includes('abuse')) abuseEmail = match[0];
    }
  }

  if (data.events) {
    for (const event of data.events) {
      if (event.eventAction === 'registration') creationDate = event.eventDate;
      if (event.eventAction === 'expiration') expirationDate = event.eventDate;
    }
  }

  if (data.nameservers) {
    for (const ns of data.nameservers) {
      if (ns.ldhName) nameServers.push(ns.ldhName);
    }
  }

  return {
    registrar,
    abuseEmail,
    creationDate,
    expirationDate,
    nameServers,
    fetchedAt: new Date().toISOString(),
    source: 'rdap',
  };
}

async function main() {
  const targets = await prisma.detectedDomain.findMany({
    where: { whoisData: null },
    select: { id: true, domain: true },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`[BackfillWhois] 対象: ${targets.length}件 (whoisData=null)`);
  if (DRY_RUN) console.log('[BackfillWhois] DRY_RUN モード — DB更新なし');

  let success = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    console.log(`[BackfillWhois] バッチ ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length}件処理中...`);

    for (const target of batch) {
      try {
        const result = await fetchRdap(target.domain);
        if (!result) {
          console.log(`  ✗ ${target.domain}: RDAP応答なし`);
          failed++;
          continue;
        }

        if (!DRY_RUN) {
          await prisma.detectedDomain.update({
            where: { id: target.id },
            data: { whoisData: JSON.stringify(result) },
          });
        }

        console.log(`  ✓ ${target.domain}: registrar=${result.registrar}`);
        success++;
      } catch (err: any) {
        console.log(`  ✗ ${target.domain}: ${err.message}`);
        failed++;
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`[BackfillWhois] 完了: 成功=${success}, 失敗=${failed}, 合計=${targets.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
