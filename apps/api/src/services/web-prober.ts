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

// Realistic browser user agent to avoid bot detection
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Get Chromium executable path for the current environment
 */
async function getChromiumPath(): Promise<string | undefined> {
  // 1. Check PLAYWRIGHT_BROWSERS_PATH first (most reliable in Docker)
  const browserPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (browserPath) {
    try {
      const entries = await fs.readdir(browserPath);
      const chromiumDir = entries.find(e => e.startsWith('chromium-'));
      if (chromiumDir) {
        const chromePath = path.join(browserPath, chromiumDir, 'chrome-linux', 'chrome');
        await fs.access(chromePath);
        console.log(`[WebProber] Using Chromium from PLAYWRIGHT_BROWSERS_PATH: ${chromePath}`);
        return chromePath;
      }
    } catch {
      // Could not find in PLAYWRIGHT_BROWSERS_PATH
    }
  }

  // 2. Try Playwright's built-in path
  try {
    const execPath = chromium.executablePath();
    if (execPath) {
      await fs.access(execPath);
      console.log(`[WebProber] Using Playwright Chromium: ${execPath}`);
      return execPath;
    }
  } catch {
    // Playwright path not accessible
  }

  // 3. Check common Docker/Linux paths manually
  const commonPaths = [
    '/app/.playwright-browsers',
    '/root/.cache/ms-playwright',
    '/home/node/.cache/ms-playwright',
  ];

  for (const basePath of commonPaths) {
    try {
      const entries = await fs.readdir(basePath);
      const chromiumDir = entries.find(e => e.startsWith('chromium-'));
      if (chromiumDir) {
        const chromePath = path.join(basePath, chromiumDir, 'chrome-linux', 'chrome');
        await fs.access(chromePath);
        console.log(`[WebProber] Found Chromium at: ${chromePath}`);
        return chromePath;
      }
    } catch {
      // Path not accessible, continue
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
  let sslInfo: string | null = null;
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
      userAgent: USER_AGENT,
      extraHTTPHeaders: {
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    let response;
    let httpsResponse; // Keep HTTPS response separately for SSL extraction
    try {
      console.log(`[WebProber] Trying HTTPS for ${domain.domain}`);
      response = await page.goto(`https://${domain.domain}`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
      httpsResponse = response;
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

    // Extract SSL certificate info from HTTPS response
    const sslSource = httpsResponse ?? response;
    if (sslSource) {
      try {
        const securityDetails = await sslSource.securityDetails();
        if (securityDetails) {
          sslInfo = JSON.stringify({
            issuer: securityDetails.issuer,
            protocol: securityDetails.protocol,
            subjectName: securityDetails.subjectName,
            validFrom: securityDetails.validFrom,
            validTo: securityDetails.validTo,
          });
          console.log(`[WebProber] SSL info extracted for ${domain.domain}: issuer=${securityDetails.issuer}`);
        } else {
          console.log(`[WebProber] No SSL certificate available for ${domain.domain}`);
        }
      } catch (sslErr: any) {
        console.log(`[WebProber] SSL extraction failed for ${domain.domain}: ${sslErr.message}`);
      }
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

  // 3. IP geolocation (country code)
  let countryCode: string | null = null;
  if (ip) {
    try {
      const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (geoRes.ok) {
        const geo = await geoRes.json();
        countryCode = geo.countryCode || null;
        console.log(`[WebProber] GeoIP: ${ip} -> ${countryCode}`);
      }
    } catch (e: any) {
      console.log(`[WebProber] GeoIP lookup failed for ${ip}: ${e.message}`);
    }
  }

  // 4. Save to DB
  const probe = await prisma.webProbe.create({
    data: {
      detectedDomainId,
      httpStatus,
      finalUrl,
      ip,
      countryCode,
      htmlSnippet,
      headers,
      screenshotPath,
      dnsResolved,
      error,
    },
  });

  // Update DetectedDomain with screenshot and SSL info
  const domainUpdate: Record<string, unknown> = {};
  if (screenshotPath) domainUpdate.screenshotUrl = screenshotPath;
  if (sslInfo) domainUpdate.sslInfo = sslInfo;

  if (Object.keys(domainUpdate).length > 0) {
    await prisma.detectedDomain.update({
      where: { id: detectedDomainId },
      data: domainUpdate,
    });
  }

  return probe;
}
