import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create organization
  const org = await prisma.organization.create({
    data: { name: 'Demo Corp' },
  });

  // Create brand
  const brand = await prisma.brand.create({
    data: {
      organizationId: org.id,
      name: 'Demo Brand',
      domain: 'demobrand.com',
      keywords: 'デモブランド,demo',
    },
  });

  // Create sample detected domains
  const threats = [
    { domain: 'dem0brand.com', source: 'domain_generation', status: 'confirmed_threat', riskScore: 92 },
    { domain: 'demobrand-login.com', source: 'ct_monitor', status: 'confirmed_threat', riskScore: 88 },
    { domain: 'demobrands.com', source: 'domain_generation', status: 'new_domain', riskScore: 65 },
    { domain: 'demobrand.net', source: 'domain_generation', status: 'analyzing', riskScore: 55 },
    { domain: 'demo-brand.co', source: 'ct_monitor', status: 'new_domain', riskScore: 72 },
    { domain: 'demobrand-support.com', source: 'ct_monitor', status: 'confirmed_threat', riskScore: 95 },
    { domain: 'demobrand.xyz', source: 'domain_generation', status: 'false_positive', riskScore: 20 },
    { domain: 'mydemobrand.com', source: 'ct_monitor', status: 'takedown_sent', riskScore: 85 },
    { domain: 'demobrand-secure.com', source: 'ct_monitor', status: 'resolved', riskScore: 78 },
    { domain: 'dem0brand.net', source: 'domain_generation', status: 'new_domain', riskScore: 70 },
  ];

  for (const t of threats) {
    const dd = await prisma.detectedDomain.create({
      data: {
        brandId: brand.id,
        domain: t.domain,
        source: t.source,
        status: t.status,
        riskScore: t.riskScore,
      },
    });

    // Add analysis for confirmed threats
    if (t.status === 'confirmed_threat' || t.riskScore >= 80) {
      await prisma.threatAnalysis.create({
        data: {
          detectedDomainId: dd.id,
          category: t.riskScore >= 85 ? 'phishing' : 'brand_abuse',
          confidence: t.riskScore / 100,
          reasoning: t.riskScore >= 85
            ? `${t.domain} は ${brand.domain} に酷似したフィッシングサイトの可能性が高い。ドメイン名の類似性とSSL証明書のパターンから判断。`
            : `${t.domain} はブランド名を不正に使用している可能性がある。`,
        },
      });
    }
  }

  console.log('✅ Seed data created');
  console.log(`   Organization: ${org.name} (${org.id})`);
  console.log(`   Brand: ${brand.name} (${brand.id})`);
  console.log(`   Detected domains: ${threats.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
