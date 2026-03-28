import { chromium, Browser, Page } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

/**
 * Capture a screenshot of a URL using Playwright
 */
export async function captureScreenshot(url: string): Promise<string> {
  console.log(`[Screenshot] Starting capture for: ${url}`);
  console.log(`[Screenshot] DATA_DIR: ${DATA_DIR}, SCREENSHOTS_DIR: ${SCREENSHOTS_DIR}`);

  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  const filename = `${Date.now()}-${url.replace(/[^a-z0-9]/gi, '_').slice(0, 50)}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    console.log('[Screenshot] Launching Chromium browser...');
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-networking',
        '--single-process',
        '--no-zygote',
      ],
    });
    console.log('[Screenshot] Browser launched successfully');

    page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    });

    // Extract domain from URL (remove protocol and path)
    const domain = url.replace(/^https?:\/\//, '').split('/')[0];
    console.log(`[Screenshot] Extracted domain: ${domain}`);

    let navigated = false;
    const urls = [`https://${domain}`, `http://${domain}`];
    let lastError: Error | null = null;

    for (const targetUrl of urls) {
      if (navigated) break;
      console.log(`[Screenshot] Attempting to navigate to: ${targetUrl}`);
      try {
        await page.goto(targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
        // Wait additional time for rendering
        await page.waitForTimeout(3000);
        console.log(`[Screenshot] Successfully navigated to: ${targetUrl}`);
        navigated = true;
      } catch (err: any) {
        lastError = err;
        console.error(`[Screenshot] Failed to navigate to ${targetUrl}:`, err.message);
      }
    }

    if (!navigated) {
      throw new Error(`Failed to navigate to any URL for domain: ${domain}. Last error: ${lastError?.message || 'Unknown'}`);
    }

    console.log(`[Screenshot] Taking screenshot to: ${filepath}`);
    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`[Screenshot] Screenshot saved successfully`);

    // Verify file was created
    const stats = await fs.stat(filepath);
    console.log(`[Screenshot] File size: ${stats.size} bytes`);

    return filepath;
  } catch (err: any) {
    console.error('[Screenshot] Fatal error:', err);
    throw err;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Ignore page close errors
      }
    }
    if (browser) {
      try {
        await browser.close();
        console.log('[Screenshot] Browser closed');
      } catch (e) {
        console.error('[Screenshot] Error closing browser:', e);
      }
    }
  }
}
