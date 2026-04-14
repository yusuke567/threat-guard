import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import brandsRouter from './routes/brands.js';
import threatsRouter from './routes/threats.js';
import scansRouter from './routes/scans.js';
import takedownsRouter from './routes/takedowns.js';
import authRouter from './routes/auth.js';
import organizationsRouter from './routes/organizations.js';
import dashboardRouter from './routes/dashboard.js';
import webProbeRouter from './routes/web-probe.js';
import reportsRouter from './routes/reports.js';
import phishingPatternsRouter from './routes/phishing-patterns.js';
import alertsRouter from './routes/alerts.js';
import takedownBatchRouter from './routes/takedown-batch.js';
import socialMonitorRouter from './routes/social-monitor.js';
import publicDiagnoseRouter from './routes/public-diagnose.js';
import browserReportsRouter from './routes/browser-reports.js';
import activityLogsRouter from './routes/activity-logs.js';
import feedImportsRouter from './routes/feed-imports.js';
import { startScheduler } from './services/scheduler.js';
import { authMiddleware, requireOrg, requireSuperAdmin } from './lib/auth-middleware.js';
import { activityLogger } from './lib/activity-logger.js';

// Prevent unhandled rejections from crashing the process
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(activityLogger);

// Persistent data directory (Railway Volume mount point or cwd fallback)
const DATA_DIR = process.env.DATA_DIR || process.cwd();

// Serve screenshots as static files
app.use('/screenshots', express.static(path.join(DATA_DIR, 'screenshots')));
// Serve uploaded files (logos etc.)
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: 'playwright-fix-v2' });
});

// Playwright/Browser health check (public)
app.get('/api/health/browser', async (_req, res) => {
  const { chromium } = await import('playwright');
  const fs = await import('node:fs/promises');
  const pathModule = await import('node:path');

  // Same args as used in screenshot services
  const CHROMIUM_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--single-process',
    '--no-zygote',
  ];

  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || 'not set',
    DATA_DIR: process.env.DATA_DIR || 'not set',
  };

  // Helper to find Chromium path (same logic as screenshot services)
  async function getChromiumPath(): Promise<string | undefined> {
    const browserPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
    if (browserPath) {
      try {
        const entries = await fs.readdir(browserPath);
        const chromiumDir = entries.find((e: string) => e.startsWith('chromium-'));
        if (chromiumDir) {
          const chromePath = pathModule.join(browserPath, chromiumDir, 'chrome-linux', 'chrome');
          await fs.access(chromePath);
          return chromePath;
        }
      } catch {
        // Could not find in PLAYWRIGHT_BROWSERS_PATH
      }
    }

    try {
      const execPath = chromium.executablePath();
      if (execPath) {
        await fs.access(execPath);
        return execPath;
      }
    } catch {
      // Playwright path not accessible
    }

    return undefined;
  }

  // Check Playwright executable path
  try {
    const execPath = chromium.executablePath();
    checks.playwrightExecPath = execPath;
    try {
      await fs.access(execPath);
      checks.playwrightExecExists = true;
    } catch {
      checks.playwrightExecExists = false;
    }
  } catch (err: any) {
    checks.playwrightExecError = err.message;
  }

  // Check PLAYWRIGHT_BROWSERS_PATH contents
  const browserPath = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (browserPath) {
    try {
      const entries = await fs.readdir(browserPath);
      checks.browserPathContents = entries;
    } catch (err: any) {
      checks.browserPathError = err.message;
    }
  }

  // Get actual executable path that will be used
  const executablePath = await getChromiumPath();
  checks.resolvedExecutablePath = executablePath || 'default (playwright resolution)';

  // Try to launch browser with same config as screenshot services
  try {
    const browser = await chromium.launch({
      headless: true,
      executablePath,
      args: CHROMIUM_ARGS,
    });
    checks.browserLaunch = 'success';
    checks.browserVersion = browser.version();

    // Try to create a page and navigate (more comprehensive test)
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 720 },
      });
      await page.setContent('<html><body>Test</body></html>');
      checks.pageCreate = 'success';
      await page.close();
    } catch (pageErr: any) {
      checks.pageCreate = 'failed';
      checks.pageCreateError = pageErr.message;
    }

    await browser.close();
  } catch (err: any) {
    checks.browserLaunch = 'failed';
    checks.browserLaunchError = err.message;
  }

  const allOk = checks.browserLaunch === 'success' && checks.pageCreate === 'success';
  res.status(allOk ? 200 : 500).json({ status: allOk ? 'ok' : 'error', checks });
});

// Auth routes (public)
app.use('/api/auth', authRouter);

// Free diagnosis (public — no auth required)
app.use('/api/public/diagnose', publicDiagnoseRouter);

// All routes below require authentication + organization
app.use('/api/organizations', authMiddleware, organizationsRouter);
app.use('/api/brands', authMiddleware, requireOrg, brandsRouter);
app.use('/api/threats', authMiddleware, requireOrg, threatsRouter);
app.use('/api/scans', authMiddleware, requireOrg, scansRouter);
app.use('/api/takedowns', authMiddleware, requireOrg, takedownsRouter);
app.use('/api/dashboard', authMiddleware, requireOrg, dashboardRouter);
app.use('/api/web-probe', authMiddleware, requireOrg, webProbeRouter);
app.use('/api/reports', authMiddleware, requireOrg, reportsRouter);
app.use('/api', authMiddleware, requireOrg, phishingPatternsRouter);
app.use('/api/alerts', authMiddleware, alertsRouter);
app.use('/api/takedown-batches', authMiddleware, requireOrg, takedownBatchRouter);
app.use('/api/social-posts', authMiddleware, requireOrg, socialMonitorRouter);
app.use('/api/browser-reports', authMiddleware, requireOrg, browserReportsRouter);
app.use('/api/activity-logs', authMiddleware, requireSuperAdmin, activityLogsRouter);
app.use('/api/admin/feed-imports', authMiddleware, requireSuperAdmin, feedImportsRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'サーバーで問題が発生しました。しばらくしてからもう一度お試しください。' });
});

app.listen(Number(port), '0.0.0.0', () => {
  console.log(`[ThreatGuard] API running on http://0.0.0.0:${port}`);
  startScheduler();
});

export default app;
