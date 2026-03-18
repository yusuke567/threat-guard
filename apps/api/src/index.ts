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
import { startScheduler } from './services/scheduler.js';
import { authMiddleware, requireOrg } from './lib/auth-middleware.js';

// Prevent unhandled rejections from crashing the process
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Persistent data directory (Railway Volume mount point or cwd fallback)
const DATA_DIR = process.env.DATA_DIR || process.cwd();

// Serve screenshots as static files
app.use('/screenshots', express.static(path.join(DATA_DIR, 'screenshots')));
// Serve uploaded files (logos etc.)
app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads')));

// Health check (public)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: 'dfaacea-smtp465' });
});

// TEMPORARY: one-time domain sync (remove after execution)
app.post('/api/_sync-brand-domains', async (_req, res) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const p = new PrismaClient();
    const brands = await p.brand.findMany({ include: { brandDomains: true } });
    const results: Array<{ brand: string; created: number; skipped: number }> = [];
    for (const brand of brands) {
      const existing = new Set(brand.brandDomains.map((bd: any) => bd.domain.toLowerCase()));
      const wl = (brand.whitelistDomains || '').split(',').map((d: string) => d.trim().toLowerCase()).filter((d: string) => d.length > 0 && d.includes('.'));
      const primary = brand.domain.toLowerCase();
      const all = new Set([primary, ...wl]);
      let created = 0, skipped = 0;
      for (const domain of all) {
        if (existing.has(domain)) { skipped++; continue; }
        await p.brandDomain.create({ data: { brandId: brand.id, domain, type: domain === primary ? 'primary' : 'owned' } });
        created++;
      }
      const ep = brand.brandDomains.find((bd: any) => bd.domain.toLowerCase() === primary);
      if (ep && ep.type !== 'primary') await p.brandDomain.update({ where: { id: ep.id }, data: { type: 'primary' } });
      results.push({ brand: brand.name, created, skipped });
    }
    await p.$disconnect();
    res.json({ totalBrands: brands.length, totalCreated: results.reduce((s, r) => s + r.created, 0), results });
  } catch (err: any) { console.error(err); res.status(500).json({ error: err.message }); }
});

// Auth routes (public)
app.use('/api/auth', authRouter);

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

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'サーバーで問題が発生しました。しばらくしてからもう一度お試しください。' });
});

app.listen(Number(port), '0.0.0.0', () => {
  console.log(`🛡️  ThreatGuard API running on http://0.0.0.0:${port}`);
  startScheduler();
});

export default app;
