import { monitorBrand } from '../src/services/ct-monitor.js';

const brandId = process.argv[2] || 'ce09f3c8-c745-4ac5-a787-fd9d2e6730a7';

async function run() {
  console.log('Starting CT Logs scan for brand:', brandId);
  const count = await monitorBrand(brandId);
  console.log('New domains found:', count);
}

run().catch(console.error).finally(() => process.exit(0));
