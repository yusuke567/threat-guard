import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function classifyDomain(detected: string, original: string): { category: string; confidence: number; reasoning: string } {
  const detectedName = detected.split('.')[0].toLowerCase();
  const originalName = original.split('.')[0].toLowerCase();

  // Subdomain of original domain
  if (detected.endsWith('.' + original)) {
    return {
      category: 'legitimate',
      confidence: 0.6,
      reasoning: `${detected} は ${original} のサブドメインです。正規のサービスである可能性が高いですが、確認が必要です。`,
    };
  }

  // Homoglyph detection (non-ASCII characters)
  const hasNonAscii = /[^\x00-\x7F]/.test(detectedName);
  if (hasNonAscii) {
    return {
      category: 'phishing',
      confidence: 0.9,
      reasoning: `${detected} はホモグリフ攻撃の可能性があります。非ASCII文字を使用してブランド名を模倣しています。`,
    };
  }

  // Very similar name (1-2 char difference) with different TLD or typo
  const distance = levenshtein(detectedName, originalName);
  
  if (distance === 0) {
    // Same name, different TLD
    return {
      category: 'brand_abuse',
      confidence: 0.8,
      reasoning: `${detected} はブランド名と同一のドメイン名を異なるTLDで取得しています。ブランド悪用の可能性があります。`,
    };
  }

  if (distance <= 2) {
    return {
      category: 'phishing',
      confidence: 0.75,
      reasoning: `${detected} はブランドドメインと${distance}文字の違いしかありません。タイポスクワッティングによるフィッシングの可能性があります。`,
    };
  }

  if (detectedName.includes(originalName) || originalName.includes(detectedName)) {
    return {
      category: 'brand_abuse',
      confidence: 0.7,
      reasoning: `${detected} はブランド名を含んでいます。ブランドを利用した不正サイトの可能性があります。`,
    };
  }

  return {
    category: 'unknown',
    confidence: 0.5,
    reasoning: `${detected} のリスクレベルは不明です。手動での確認を推奨します。`,
  };
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

async function run() {
  const domains = await prisma.detectedDomain.findMany({
    where: { brand: { domain: 'coincheck.com' } },
    include: { brand: true, analyses: true },
  });

  console.log(`Classifying ${domains.length} domains...`);

  let stats = { phishing: 0, brand_abuse: 0, legitimate: 0, unknown: 0, parked: 0 };

  for (const domain of domains) {
    // Skip if already analyzed
    if (domain.analyses.length > 0) continue;

    const result = classifyDomain(domain.domain, domain.brand.domain);
    
    await prisma.threatAnalysis.create({
      data: {
        detectedDomainId: domain.id,
        category: result.category,
        confidence: result.confidence,
        reasoning: result.reasoning,
      },
    });

    // Update status
    const newStatus = result.category === 'phishing' || result.category === 'brand_abuse'
      ? 'confirmed_threat'
      : result.category === 'legitimate'
        ? 'false_positive'
        : 'new_domain';

    await prisma.detectedDomain.update({
      where: { id: domain.id },
      data: { status: newStatus },
    });

    stats[result.category as keyof typeof stats]++;
    console.log(`  ${domain.domain}: ${result.category} (${Math.round(result.confidence * 100)}%)`);
  }

  console.log('\n✅ Classification complete');
  console.log('Stats:', stats);
}

run().catch(console.error).finally(() => prisma.$disconnect());
