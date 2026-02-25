import { chromium } from 'playwright';
import { resolve4 } from 'node:dns/promises';
import path from 'node:path';
import fs from 'node:fs/promises';
import { prisma } from '../lib/prisma.js';

const SCREENSHOTS_DIR = path.join(process.cwd(), 'screenshots');

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
    }
  } catch (e: any) {
    // DNS failed — domain may not resolve, continue anyway
  }

  // 2. Playwright probe
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
    });

    let response;
    try {
      response = await page.goto(`https://${domain.domain}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
    } catch {
      // HTTPS failed or timed out, try HTTP
      try {
        response = await page.goto(`http://${domain.domain}`, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });
      } catch (e: any) {
        error = `Navigation failed: ${e.message}`;
        // Capture partial page info even on timeout
        try {
          httpStatus = (await page.evaluate(() => document.readyState)) ? null : null;
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
    } catch { /* ignore */ }

  } finally {
    await browser.close();
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
