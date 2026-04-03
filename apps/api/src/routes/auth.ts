import { Router } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { signToken } from '../lib/auth-middleware.js';
import { sendMail } from '../services/mail.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Login - returns JWT
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'メールアドレスとパスワードを正しく入力してください。' });

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    include: { organization: true },
  });
  if (!user) return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });

  const valid = await bcrypt.compare(parsed.data.password, user.hashedPassword);
  if (!valid) return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });

  const token = signToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    organizationId: user.organizationId,
    role: user.role,
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization?.name ?? null,
    },
  });
});

// Forgot password - send reset email
router.post('/forgot-password', async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: '有効なメールアドレスを入力してください。' });
    }

    const { email } = parsed.data;

    // Always return success to avoid user enumeration
    const successResponse = { message: 'パスワードリセット用のメールを送信しました。' };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json(successResponse);
    }

    // Rate limit: block if a token was created within the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentToken = await prisma.passwordResetToken.findFirst({
      where: { email, createdAt: { gte: fiveMinutesAgo } },
    });
    if (recentToken) {
      return res.json(successResponse);
    }

    // Generate token, hash it, and store
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { email, tokenHash, expiresAt },
    });

    // Send reset email
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink = `${FRONTEND_URL}/reset-password?token=${rawToken}`;

    await sendMail({
      to: email,
      subject: '【ThreatGuard】パスワードリセットのご案内',
      html: `
        <p>パスワードリセットのリクエストを受け付けました。</p>
        <p>以下のリンクをクリックして、新しいパスワードを設定してください。</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>このリンクの有効期限は1時間です。</p>
        <p>心当たりがない場合は、このメールを無視してください。</p>
      `,
    });

    res.json(successResponse);
  } catch (err) {
    console.error('[auth] forgot-password error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

// Reset password - verify token and update password
router.post('/reset-password', async (req, res) => {
  try {
    const schema = z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'トークンと新しいパスワード（8文字以上）を入力してください。' });
    }

    const { token, newPassword } = parsed.data;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken) {
      return res.status(400).json({ error: '無効なトークンです。' });
    }
    if (resetToken.usedAt) {
      return res.status(400).json({ error: 'このトークンは既に使用されています。' });
    }
    if (resetToken.expiresAt < new Date()) {
      return res.status(400).json({ error: 'トークンの有効期限が切れています。' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { email: resetToken.email },
        data: { hashedPassword },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    res.json({ message: 'パスワードが正常にリセットされました。' });
  } catch (err) {
    console.error('[auth] reset-password error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

export default router;
