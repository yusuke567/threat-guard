import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import brandsRouter from './routes/brands.js';
import threatsRouter from './routes/threats.js';
import scansRouter from './routes/scans.js';
import takedownsRouter from './routes/takedowns.js';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/brands', brandsRouter);
app.use('/api/threats', threatsRouter);
app.use('/api/scans', scansRouter);
app.use('/api/takedowns', takedownsRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`🛡️  BrandShield API running on http://localhost:${port}`);
});

export default app;
