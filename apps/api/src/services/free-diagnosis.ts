import { chromium } from 'playwright';
import { resolve4 } from 'node:dns/promises';
import path from 'node:path';
import fs from 'node:fs/promises';
import { prisma } from '../lib/prisma.js';
import { anthropic } from '../lib/anthropic.js';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

/**
 * Run a free diagnosis: DNS check, web probe, screenshot, AI analysis.
 * Lighter version of the full scan — no brand comparison needed.
 */
export async function runFreeDiagnosis(diagnosisId: string): Promise<void> {
  const diagnosis = await prisma.freeDiagnosis.findUniqueOrThrow({
    where: { id: diagnosisId },
  });

  const domain = diagnosis.domain;
  let ip: string | null = null;
  let dnsResolved = false;
  let httpStatus: number | null = null;
  let finalUrl: string | null = null;
  let htmlSnippet: string | null = null;
  let screenshotUrl: string | null = null;
  let sslInfo: string | null = null;
  let whoisData: string | null = null;

  try {
    // 1. DNS resolution
    try {
      const addresses = await resolve4(domain);
      if (addresses.length > 0) {
        ip = addresses[0];
        dnsResolved = true;
      }
    } catch {
      // DNS failed — domain may not resolve
    }

    // 2. Web probe + screenshot with Playwright
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

      let response;
      try {
        response = await page.goto(diagnosis.targetUrl, {
          waitUntil: 'networkidle',
          timeout: 20000,
        });
      } catch {
        // HTTPS might fail, try HTTP
        try {
          const httpUrl = diagnosis.targetUrl.replace('https://', 'http://');
          response = await page.goto(httpUrl, {
            waitUntil: 'networkidle',
            timeout: 20000,
          });
        } catch {
          // Both failed
        }
      }

      if (response) {
        httpStatus = response.status();
        finalUrl = page.url();
        const html = await page.content();
        if (html) htmlSnippet = html.slice(0, 5000);

        // Extract SSL info from security details
        try {
          const securityDetails = await response.securityDetails();
          if (securityDetails) {
            sslInfo = JSON.stringify({
              issuer: securityDetails.issuer,
              protocol: securityDetails.protocol,
              subjectName: securityDetails.subjectName,
              validFrom: securityDetails.validFrom,
              validTo: securityDetails.validTo,
            });
          }
        } catch {
          // SSL details may not be available
        }
      }

      // Capture screenshot
      try {
        await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
        const filename = `free-${diagnosisId}.png`;
        const filepath = path.join(SCREENSHOTS_DIR, filename);
        await page.screenshot({ path: filepath, fullPage: false });
        screenshotUrl = `/screenshots/${filename}`;
      } catch {
        // Screenshot failed — not critical
      }
    } finally {
      await browser.close();
    }

    // 3. AI analysis with Claude
    let riskScore: number | null = null;
    let category: string | null = null;
    let confidence: number | null = null;
    let reasoning: string | null = null;

    try {
      const prompt = `You are a cybersecurity analyst. Analyze the following URL/domain for potential security risks.

**Target URL:** ${diagnosis.targetUrl}
**Domain:** ${domain}
**DNS Resolved:** ${dnsResolved ? `Yes (IP: ${ip})` : 'No'}
**HTTP Status:** ${httpStatus || 'N/A'}
**Final URL:** ${finalUrl || 'N/A'}
**SSL Info:** ${sslInfo || 'Not available'}
**HTML Snippet (first 2000 chars):** ${htmlSnippet ? htmlSnippet.slice(0, 2000) : 'Not available'}

Evaluate this domain for:
1. Is this a known legitimate service or a suspicious/phishing site?
2. Does the domain name try to impersonate a well-known brand?
3. Are there signs of phishing (login forms mimicking other sites, suspicious redirects)?
4. SSL certificate validity and issuer reputation
5. Overall risk assessment

Respond in JSON format:
{
  "riskScore": 0-100 (0=safe, 100=extremely dangerous),
  "category": "safe|suspicious|phishing|brand_abuse|malware|parked|unknown",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation in Japanese (2-3 sentences)"
}`;

      const aiResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = aiResponse.content[0].type === 'text' ? aiResponse.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        riskScore = Math.min(100, Math.max(0, parsed.riskScore));
        category = parsed.category;
        confidence = parsed.confidence;
        reasoning = parsed.reasoning;
      }
    } catch (err) {
      console.error(`AI analysis failed for diagnosis ${diagnosisId}:`, err);
      // Continue without AI analysis — other data is still valuable
    }

    // 4. Update diagnosis with results
    await prisma.freeDiagnosis.update({
      where: { id: diagnosisId },
      data: {
        status: 'completed',
        riskScore,
        category,
        confidence,
        reasoning,
        screenshotUrl,
        htmlSnippet,
        dnsResolved,
        httpStatus,
        finalUrl,
        ip,
        sslInfo,
        whoisData,
      },
    });
  } catch (err: any) {
    console.error(`Free diagnosis failed for ${diagnosisId}:`, err);
    await prisma.freeDiagnosis.update({
      where: { id: diagnosisId },
      data: {
        status: 'failed',
        error: err.message || 'Unknown error',
      },
    });
  }
}
