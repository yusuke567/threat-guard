import { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma.js';

// Sensitive fields to strip from metadata
const SENSITIVE_FIELDS = new Set([
  'password', 'hashedPassword', 'token', 'smtpPass', 'smtpPassword',
  'resetToken', 'tokenHash', 'currentPassword', 'newPassword',
]);

// Route mapping: [method, pathRegex, action, category]
const ROUTE_MAP: Array<[string, RegExp, string, string]> = [
  // Auth
  ['POST', /^\/api\/auth\/login$/, 'auth.login', 'auth'],
  ['POST', /^\/api\/auth\/forgot-password$/, 'auth.forgot_password', 'auth'],
  ['POST', /^\/api\/auth\/reset-password$/, 'auth.reset_password', 'auth'],

  // Threats
  ['GET', /^\/api\/threats\/[^/]+$/, 'threat.view', 'threat'],
  ['PATCH', /^\/api\/threats\/[^/]+\/status$/, 'threat.status_change', 'threat'],

  // Scans
  ['POST', /^\/api\/scans\/trigger$/, 'scan.trigger', 'scan'],

  // Takedowns
  ['POST', /^\/api\/takedowns$/, 'takedown.create', 'takedown'],
  ['POST', /^\/api\/takedowns\/[^/]+\/send$/, 'takedown.send', 'takedown'],
  ['POST', /^\/api\/takedown-batches$/, 'takedown.batch_submit', 'takedown'],

  // Brands
  ['POST', /^\/api\/brands$/, 'brand.create', 'brand'],
  ['PUT', /^\/api\/brands\/[^/]+$/, 'brand.update', 'brand'],
  ['DELETE', /^\/api\/brands\/[^/]+$/, 'brand.delete', 'brand'],

  // Reports
  ['GET', /^\/api\/reports\/generate$/, 'report.generate', 'report'],

  // Alerts
  ['PUT', /^\/api\/alerts\/settings$/, 'alert.settings_change', 'alert'],

  // Social monitor
  ['POST', /^\/api\/social-posts\/scan$/, 'social.scan_trigger', 'social'],
  ['PATCH', /^\/api\/social-posts\/[^/]+\/status$/, 'social.status_update', 'social'],

  // Phishing patterns
  ['POST', /^\/api\/brands\/[^/]+\/phishing-patterns$/, 'phishing.create', 'phishing'],
  ['PATCH', /^\/api\/phishing-patterns\/[^/]+$/, 'phishing.update', 'phishing'],
  ['DELETE', /^\/api\/phishing-patterns\/[^/]+$/, 'phishing.delete', 'phishing'],

  // Admin
  ['POST', /^\/api\/organizations$/, 'admin.org_create', 'admin'],
  ['PUT', /^\/api\/organizations\/[^/]+$/, 'admin.org_update', 'admin'],
  ['POST', /^\/api\/organizations\/[^/]+\/users$/, 'admin.user_create', 'admin'],
  ['DELETE', /^\/api\/organizations\/[^/]+\/users\/[^/]+$/, 'admin.user_delete', 'admin'],

  // Browser reports
  ['POST', /^\/api\/browser-reports\/google$/, 'browser_report.google_submit', 'threat'],
  ['POST', /^\/api\/browser-reports\/microsoft$/, 'browser_report.microsoft_submit', 'threat'],
];

function matchRoute(method: string, path: string): { action: string; category: string } | null {
  for (const [m, re, action, category] of ROUTE_MAP) {
    if (m === method && re.test(path)) return { action, category };
  }
  return null;
}

function stripSensitive(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key)) continue;
    result[key] = value;
  }
  return result;
}

function getIpAddress(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress || null;
}

function buildMetadata(req: Request): string | null {
  const meta: Record<string, any> = {};

  // Include relevant params
  if (req.params && Object.keys(req.params).length > 0) {
    meta.params = req.params;
  }

  // Include body for write operations (stripped of sensitive fields)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body) {
    const cleaned = stripSensitive(req.body);
    if (Object.keys(cleaned).length > 0) {
      meta.body = cleaned;
    }
  }

  // Include relevant query params
  if (req.query && Object.keys(req.query).length > 0) {
    meta.query = req.query;
  }

  return Object.keys(meta).length > 0 ? JSON.stringify(meta) : null;
}

async function writeLog(
  req: Request,
  statusCode: number,
  duration: number,
  match: { action: string; category: string },
  responseBody?: any,
) {
  try {
    // For login, user info comes from request body / response
    let userId: string | null = req.user?.userId || null;
    let userEmail: string = req.user?.email || '';
    let userName: string | null = req.user?.name || null;
    let organizationId: string | null = req.user?.organizationId || null;

    if (match.action === 'auth.login') {
      userEmail = req.body?.email || '';
      if (statusCode === 200 && responseBody?.user) {
        userId = responseBody.user.id || null;
        userName = responseBody.user.name || null;
        organizationId = responseBody.user.organizationId || null;
      }
    }

    // Skip if no email (can't identify user)
    if (!userEmail) return;

    await prisma.activityLog.create({
      data: {
        userId,
        userEmail,
        userName,
        organizationId,
        action: match.action,
        category: match.category,
        method: req.method,
        path: req.originalUrl || req.path,
        statusCode,
        ipAddress: getIpAddress(req),
        metadata: buildMetadata(req),
        duration,
      },
    });
  } catch (err) {
    console.error('[activity-logger] write error:', err);
  }
}

export function activityLogger(req: Request, res: Response, next: NextFunction) {
  const match = matchRoute(req.method, req.path);
  if (!match) return next();

  const startTime = Date.now();
  const originalJson = res.json.bind(res);

  res.json = function (body: any) {
    const duration = Date.now() - startTime;
    // Fire-and-forget: don't block the response
    writeLog(req, res.statusCode, duration, match, body).catch(() => {});
    return originalJson(body);
  } as any;

  next();
}
