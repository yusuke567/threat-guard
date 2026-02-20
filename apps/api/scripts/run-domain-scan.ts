import { scanDomainVariations } from '../src/services/domain-generator.js';

const brandId = process.argv[2] || 'ce09f3c8-c745-4ac5-a787-fd9d2e6730a7';

async function run() {
  console.log('Starting domain variation scan for brand:', brandId);
  const count = await scanDomainVariations(brandId);
  console.log('New domains found:', count);
}

run().catch(console.error).finally(() => process.exit(0));
