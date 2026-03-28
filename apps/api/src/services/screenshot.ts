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

  const filename = `${Date.now()}-${url.replace(/[^a-z0-9]/gi, '_').slice(0, 50)}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });

    // Extract domain from URL (remove protocol and path)
    const domain = url.replace(/^https?:\/\//, '').split('/')[0];

    let navigated = false;
    const urls = [`https://${domain}`, `http://${domain}`];

    for (const targetUrl of urls) {
      if (navigated) break;
      try {
        await page.goto(targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        // Wait additional time for rendering
        await page.waitForTimeout(2000);
        navigated = true;
      } catch (err) {
        console.error(`[Screenshot] Failed to navigate to ${targetUrl}:`, err);
      }
    }

    if (!navigated) {
      throw new Error(`Failed to navigate to any URL for domain: ${domain}`);
    }

    await page.screenshot({ path: filepath, fullPage: false });
    return filepath;
  } finally {
    await browser.close();
  }
}
