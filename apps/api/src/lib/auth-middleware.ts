import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const TOKEN_EXPIRY = '7d';

export interface AuthUser {
  userId: string;
  email: string;
  name: string | null;
  organizationId: string | null;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'ログインが必要です。ログイン画面からログインしてください。' });
  }
  try {
    const payload = verifyToken(header.slice(7));
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { deletedAt: true },
    });
    if (user?.deletedAt) {
      return res.status(401).json({ error: 'このアカウントは無効化されています。管理者にお問い合わせください。' });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'ログインの有効期限が切れました。もう一度ログインしてください。' });
  }
}

export function requireOrg(req: Request, res: Response, next: NextFunction) {
  // superadmin bypasses org check
  if (req.user?.role === 'superadmin') return next();
  if (!req.user?.organizationId) {
    return res.status(403).json({ error: '所属する組織が設定されていません。管理者にお問い合わせください。' });
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'superadmin') {
    return res.status(403).json({ error: 'この操作には管理者権限が必要です。' });
  }
  next();
}
