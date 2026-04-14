import { chromium, Browser } from 'playwright';
import { resolve4 } from 'node:dns/promises';
import path from 'node:path';
import fs from 'node:fs/promises';
import { getDomain } from 'tldts';
import { prisma } from '../lib/prisma.js';
import { anthropic } from '../lib/anthropic.js';
import { lookupWhoisRaw } from './whois-lookup.js';

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
        console.log(`[FreeDiagnosis] Using Chromium from PLAYWRIGHT_BROWSERS_PATH: ${chromePath}`);
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
      console.log(`[FreeDiagnosis] Using Playwright Chromium: ${execPath}`);
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
        console.log(`[FreeDiagnosis] Found Chromium at: ${chromePath}`);
        return chromePath;
      }
    } catch {
      // Path not accessible, continue
    }
  }

  return undefined;
}

/**
 * JPCERT/CC等の既知フィッシングURL履歴と照合する高速判定。
 * URL完全一致 or 同一ドメインヒットがあれば、ブラウザ起動・AI解析を省略して即時判定。
 */
async function checkKnownPhishingMatch(targetUrl: string, domain: string) {
  // URL完全一致が最優先
  const urlExactHit = await prisma.knownPhishingUrl.findFirst({
    where: { url: targetUrl },
    orderBy: { observedAt: 'desc' },
  });
  if (urlExactHit) return { kind: 'url_exact' as const, hit: urlExactHit };

  // 末尾 `/` 有無の揺れを吸収（"https://x.com" / "https://x.com/"）
  const altUrl = targetUrl.endsWith('/') ? targetUrl.slice(0, -1) : targetUrl + '/';
  const urlAltHit = await prisma.knownPhishingUrl.findFirst({
    where: { url: altUrl },
    orderBy: { observedAt: 'desc' },
  });
  if (urlAltHit) return { kind: 'url_exact' as const, hit: urlAltHit };

  // ドメイン一致（過去にこのドメインがフィッシングに使われた履歴）
  const domainHit = await prisma.knownPhishingUrl.findFirst({
    where: { domain },
    orderBy: { observedAt: 'desc' },
  });
  if (domainHit) {
    const total = await prisma.knownPhishingUrl.count({ where: { domain } });
    return { kind: 'domain' as const, hit: domainHit, total };
  }

  // 登録ドメイン（eTLD+1）一致：サブドメインを跨いだフィッシング流用を捕捉
  // 例: JPCERTには `login.evil.com` があり、ユーザが `evil.com` を入力したケース
  const registeredDomain = getDomain(domain);
  if (registeredDomain && registeredDomain !== domain) {
    const subHit = await prisma.knownPhishingUrl.findFirst({
      where: { domain: { endsWith: `.${registeredDomain}` } },
      orderBy: { observedAt: 'desc' },
    });
    if (subHit) {
      const total = await prisma.knownPhishingUrl.count({
        where: { domain: { endsWith: `.${registeredDomain}` } },
      });
      return { kind: 'registered_domain' as const, hit: subHit, total, registeredDomain };
    }
  }

  return null;
}

function formatJstDate(d: Date): string {
  return d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Run a free diagnosis: DNS check, web probe, screenshot, AI analysis.
 * Lighter version of the full scan — no brand comparison needed.
 */
export async function runFreeDiagnosis(diagnosisId: string): Promise<void> {
  const diagnosis = await prisma.freeDiagnosis.findUniqueOrThrow({
    where: { id: diagnosisId },
  });

  const domain = diagnosis.domain;

  // === Fast-path: JPCERT/CC等の既知フィッシングURL履歴で即判定 ===
  // ヒット時はブラウザ起動・AI解析を省略しコスト削減＋応答速度向上
  try {
    const match = await checkKnownPhishingMatch(diagnosis.targetUrl, domain);
    if (match) {
      const observed = formatJstDate(match.hit.observedAt);
      const sourceLabel = match.hit.source === 'jpcert' ? 'JPCERT/CC' : match.hit.source;
      let reasoning: string;
      let confidence: number;
      if (match.kind === 'url_exact') {
        reasoning = `${sourceLabel}が${observed}に「${match.hit.brandLabel}」を装ったフィッシングURLとして観測した完全一致URLです。即座にアクセスを中止してください。`;
        confidence = 1.0;
      } else if (match.kind === 'domain') {
        reasoning = `${sourceLabel}が過去に「${match.hit.brandLabel}」を装ったフィッシングURLとして観測したドメイン（最終観測: ${observed}、観測回数: ${match.total}件）です。同一ドメイン上の他のページも危険な可能性が極めて高いです。`;
        confidence = 0.95;
      } else {
        reasoning = `登録ドメイン「${match.registeredDomain}」配下で、${sourceLabel}が過去に「${match.hit.brandLabel}」を装ったフィッシングURLとして観測しています（最終観測: ${observed}、配下サブドメイン観測数: ${match.total}件）。このドメイン全体の信頼性が損なわれています。`;
        confidence = 0.85;
      }

      await prisma.freeDiagnosis.update({
        where: { id: diagnosisId },
        data: {
          status: 'completed',
          riskScore: 100,
          category: 'phishing',
          confidence,
          reasoning,
        },
      });
      console.log(`[FreeDiagnosis] JPCERT fast-path hit (${match.kind}) for ${diagnosis.targetUrl}`);
      return;
    }
  } catch (err) {
    console.error(`[FreeDiagnosis] JPCERT lookup failed (continuing with normal flow):`, err);
  }
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
    let browser: Browser | null = null;
    try {
      const executablePath = await getChromiumPath();
      console.log(`[FreeDiagnosis] Launching browser for ${diagnosis.targetUrl}`);
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
      try {
        response = await page.goto(diagnosis.targetUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
        await page.waitForTimeout(2000);
      } catch (httpsErr: any) {
        console.log(`[FreeDiagnosis] Primary URL failed: ${httpsErr.message}`);
        // HTTPS might fail, try HTTP
        try {
          const httpUrl = diagnosis.targetUrl.replace('https://', 'http://');
          response = await page.goto(httpUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 45000,
          });
          await page.waitForTimeout(2000);
        } catch (httpErr: any) {
          console.log(`[FreeDiagnosis] HTTP fallback also failed: ${httpErr.message}`);
          // Both failed
        }
      }

      if (response) {
        httpStatus = response.status();
        finalUrl = page.url();
        const html = await page.content();
        if (html) htmlSnippet = html.slice(0, 5000);
        console.log(`[FreeDiagnosis] Got response: status=${httpStatus}`);

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
        console.log(`[FreeDiagnosis] Screenshot saved: ${screenshotUrl}`);
      } catch (screenshotErr: any) {
        console.error(`[FreeDiagnosis] Screenshot failed: ${screenshotErr.message}`);
      }

      await page.close();
    } catch (browserErr: any) {
      console.error(`[FreeDiagnosis] Browser error: ${browserErr.message}`);
      console.error(`[FreeDiagnosis] Browser error stack: ${browserErr.stack}`);
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeErr) {
          console.error(`[FreeDiagnosis] Error closing browser:`, closeErr);
        }
      }
    }

    // 2.5. WHOIS/RDAP lookup
    try {
      whoisData = await lookupWhoisRaw(domain);
    } catch (whoisErr) {
      console.error(`[FreeDiagnosis] WHOIS lookup failed for ${domain}:`, whoisErr);
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

Respond in JSON format. The reasoning MUST be written in Japanese:
{
  "riskScore": 0-100 (0=safe, 100=extremely dangerous),
  "category": "safe|suspicious|phishing|brand_abuse|malware|parked|unknown",
  "confidence": 0.0-1.0,
  "reasoning": "日本語でリスク分析の説明（2-3文）"
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
