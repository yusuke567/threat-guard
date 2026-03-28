import { chromium, Browser, Page } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

// Standard Docker/containerized Chromium flags
const CHROMIUM_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-default-apps',
  '--disable-sync',
  '--disable-translate',
  '--hide-scrollbars',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-first-run',
  '--safebrowsing-disable-auto-update',
  '--single-process',
  '--no-zygote',
];

/**
 * Get Chromium executable path for the current environment
 */
async function getChromiumPath(): Promise<string | undefined> {
  try {
    // First try Playwright's built-in path
    const execPath = chromium.executablePath();
    if (execPath) {
      await fs.access(execPath);
      console.log(`[Screenshot] Using Playwright Chromium: ${execPath}`);
      return execPath;
    }
  } catch {
    // Playwright path not accessible
  }

  // Check common Docker/Linux paths
  const commonPaths = [
    '/app/.playwright-browsers/chromium-*/chrome-linux/chrome',
    '/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome',
    '/home/node/.cache/ms-playwright/chromium-*/chrome-linux/chrome',
  ];

  for (const pattern of commonPaths) {
    try {
      const { glob } = await import('node:fs/promises');
      // Node 22+ has glob, but for compatibility, just check the env var path
    } catch {
      // glob not available
    }
  }

  // Check PLAYWRIGHT_BROWSERS_PATH
  const browserPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (browserPath) {
    try {
      const entries = await fs.readdir(browserPath);
      const chromiumDir = entries.find(e => e.startsWith('chromium-'));
      if (chromiumDir) {
        const chromePath = path.join(browserPath, chromiumDir, 'chrome-linux', 'chrome');
        await fs.access(chromePath);
        console.log(`[Screenshot] Using Chromium from PLAYWRIGHT_BROWSERS_PATH: ${chromePath}`);
        return chromePath;
      }
    } catch (err) {
      console.log(`[Screenshot] Could not find Chromium in PLAYWRIGHT_BROWSERS_PATH: ${err}`);
    }
  }

  // Return undefined to let Playwright try its default
  console.log('[Screenshot] Using Playwright default browser resolution');
  return undefined;
}

/**
 * Capture a screenshot of a URL using Playwright
 */
export async function captureScreenshot(url: string): Promise<string> {
  console.log(`[Screenshot] Starting capture for: ${url}`);
  console.log(`[Screenshot] DATA_DIR: ${DATA_DIR}, SCREENSHOTS_DIR: ${SCREENSHOTS_DIR}`);
  console.log(`[Screenshot] PLAYWRIGHT_BROWSERS_PATH: ${process.env.PLAYWRIGHT_BROWSERS_PATH || 'not set'}`);

  await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });

  const filename = `${Date.now()}-${url.replace(/[^a-z0-9]/gi, '_').slice(0, 50)}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // Get Chromium executable path
    const executablePath = await getChromiumPath();

    console.log('[Screenshot] Launching Chromium browser...');
    browser = await chromium.launch({
      headless: true,
      executablePath,
      args: CHROMIUM_ARGS,
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
    console.error('[Screenshot] Error stack:', err.stack);
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
