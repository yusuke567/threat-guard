import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

/**
 * Capture a screenshot of a URL using Playwright
 */
export async function captureScreenshot(url: string): Promise<string> {
  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  // Normalize domain: strip protocol if present
  const domain = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const filename = `${Date.now()}-${domain.replace(/[^a-z0-9]/gi, '_').slice(0, 50)}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });

    try {
      await page.goto(`https://${domain}`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });
    } catch {
      // Try http if https fails
      await page.goto(`http://${domain}`, {
        waitUntil: 'networkidle',
        timeout: 15000,
      });
    }

    await page.screenshot({ path: filepath, fullPage: false });
    return filepath;
  } finally {
    await browser.close();
  }
}
