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
import { startScheduler } from './services/scheduler.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve screenshots as static files
app.use('/screenshots', express.static(path.join(process.cwd(), 'screenshots')));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/brands', brandsRouter);
app.use('/api/threats', threatsRouter);
app.use('/api/scans', scansRouter);
app.use('/api/takedowns', takedownsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/web-probe', webProbeRouter);
app.use('/api/reports', reportsRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(Number(port), '0.0.0.0', () => {
  console.log(`🛡️  BrandShield API running on http://0.0.0.0:${port}`);
  startScheduler();
});

export default app;
