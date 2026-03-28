import { chromium, Browser } from 'playwright';
import { resolve4 } from 'node:dns/promises';
import path from 'node:path';
import fs from 'node:fs/promises';
import { prisma } from '../lib/prisma.js';

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
    const execPath = chromium.executablePath();
    if (execPath) {
      await fs.access(execPath);
      return execPath;
    }
  } catch {
    // Playwright path not accessible
  }

  const browserPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (browserPath) {
    try {
      const entries = await fs.readdir(browserPath);
      const chromiumDir = entries.find(e => e.startsWith('chromium-'));
      if (chromiumDir) {
        const chromePath = path.join(browserPath, chromiumDir, 'chrome-linux', 'chrome');
        await fs.access(chromePath);
        return chromePath;
      }
    } catch {
      // Could not find in PLAYWRIGHT_BROWSERS_PATH
    }
  }

  return undefined;
}

export interface ProbeResult {
  id: string;
  httpStatus: number | null;
  finalUrl: string | null;
  ip: string | null;
  htmlSnippet: string | null;
  headers: string | null;
  screenshotPath: string | null;
  dnsResolved: boolean;
  error: string | null;
  probeAt: Date;
}

/**
 * Probe a detected domain: DNS resolve, visit with Playwright, capture everything.
 */
export async function probeDomain(detectedDomainId: string): Promise<ProbeResult> {
  const domain = await prisma.detectedDomain.findUniqueOrThrow({
    where: { id: detectedDomainId },
  });

  console.log(`[WebProber] Starting probe for domain: ${domain.domain}`);

  let ip: string | null = null;
  let dnsResolved = false;
  let httpStatus: number | null = null;
  let finalUrl: string | null = null;
  let htmlSnippet: string | null = null;
  let headers: string | null = null;
  let screenshotPath: string | null = null;
  let error: string | null = null;

  // 1. DNS resolution
  try {
    const addresses = await resolve4(domain.domain);
    if (addresses.length > 0) {
      ip = addresses[0];
      dnsResolved = true;
      console.log(`[WebProber] DNS resolved: ${domain.domain} -> ${ip}`);
    }
  } catch (e: any) {
    console.log(`[WebProber] DNS resolution failed for ${domain.domain}: ${e.message}`);
    // DNS failed — domain may not resolve, continue anyway
  }

  // 2. Playwright probe
  let browser: Browser | null = null;
  try {
    const executablePath = await getChromiumPath();
    console.log(`[WebProber] Launching browser for ${domain.domain}`);
    browser = await chromium.launch({
      headless: true,
      executablePath,
      args: CHROMIUM_ARGS,
    });
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
    });

    let response;
    try {
      console.log(`[WebProber] Trying HTTPS for ${domain.domain}`);
      response = await page.goto(`https://${domain.domain}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      // Wait for additional rendering
      await page.waitForTimeout(2000);
    } catch (httpsErr: any) {
      console.log(`[WebProber] HTTPS failed: ${httpsErr.message}, trying HTTP...`);
      // HTTPS failed or timed out, try HTTP
      try {
        response = await page.goto(`http://${domain.domain}`, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
        await page.waitForTimeout(2000);
      } catch (e: any) {
        error = `Navigation failed: ${e.message}`;
        console.log(`[WebProber] HTTP also failed: ${e.message}`);
        // Capture partial page info even on timeout
        try {
          finalUrl = page.url();
          const html = await page.content();
          if (html && html.length > 100) htmlSnippet = html.slice(0, 5000);
        } catch { /* ignore */ }
      }
    }

    if (response) {
      httpStatus = response.status();
      finalUrl = page.url();
      headers = JSON.stringify(Object.fromEntries(
        Object.entries(response.headers())
      ));
      console.log(`[WebProber] Got response: status=${httpStatus}, url=${finalUrl}`);

      // Get HTML snippet (first 5000 chars)
      try {
        const html = await page.content();
        htmlSnippet = html.slice(0, 5000);
      } catch { /* ignore */ }
    }

    // Screenshot — always attempt, even after timeout (captures partial page)
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
    const filename = `probe-${Date.now()}-${domain.domain.replace(/[^a-z0-9]/gi, '_').slice(0, 50)}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    try {
      await page.screenshot({ path: filepath, fullPage: false });
      screenshotPath = `/screenshots/${filename}`;
      console.log(`[WebProber] Screenshot saved: ${screenshotPath}`);
    } catch (screenshotErr: any) {
      console.error(`[WebProber] Screenshot failed: ${screenshotErr.message}`);
    }

    await page.close();
  } catch (browserErr: any) {
    console.error(`[WebProber] Browser error: ${browserErr.message}`);
    console.error(`[WebProber] Browser error stack: ${browserErr.stack}`);
    error = error || browserErr.message;
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log(`[WebProber] Browser closed for ${domain.domain}`);
      } catch (closeErr) {
        console.error(`[WebProber] Error closing browser:`, closeErr);
      }
    }
  }

  // 3. Save to DB
  const probe = await prisma.webProbe.create({
    data: {
      detectedDomainId,
      httpStatus,
      finalUrl,
      ip,
      htmlSnippet,
      headers,
      screenshotPath,
      dnsResolved,
      error,
    },
  });

  // Update screenshot on DetectedDomain if we got one
  if (screenshotPath) {
    await prisma.detectedDomain.update({
      where: { id: detectedDomainId },
      data: { screenshotUrl: screenshotPath },
    });
  }

  return probe;
}
