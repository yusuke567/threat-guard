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
