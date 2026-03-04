import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { requireSuperAdmin } from '../lib/auth-middleware.js';

const router = Router();

// Get current user's organization (any authenticated user)
router.get('/', async (req, res) => {
  const orgId = req.user!.organizationId;
  if (!orgId) return res.json([]);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { _count: { select: { brands: true } } },
  });

  res.json(org ? [org] : []);
});

// ── Admin-only routes ──────────────────────────────────────────

// GET /api/organizations/all — list all organizations (admin)
router.get('/all', requireSuperAdmin, async (_req, res) => {
  const orgs = await prisma.organization.findMany({
    include: { _count: { select: { brands: true, users: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(orgs);
});

// POST /api/organizations — create organization (admin)
router.post('/', requireSuperAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: '組織名を入力してください。' });
  }
  const org = await prisma.organization.create({ data: { name: name.trim() } });
  res.status(201).json(org);
});

// PUT /api/organizations/:id — update organization (admin)
router.put('/:id', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: '組織名を入力してください。' });
  }
  const org = await prisma.organization.update({
    where: { id },
    data: { name: name.trim() },
  });
  res.json(org);
});

// GET /api/organizations/:id/users — list users in org (admin)
router.get('/:id/users', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const users = await prisma.user.findMany({
    where: { organizationId: id },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

// POST /api/organizations/:id/users — invite (create) user in org (admin)
router.post('/:id/users', requireSuperAdmin, async (req, res) => {
  const { id: organizationId } = req.params;
  const { email, name, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'メールアドレスとパスワードを入力してください。' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'パスワードは8文字以上で入力してください。' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'このメールアドレスはすでに使用されています。' });
  }

  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) {
    return res.status(404).json({ error: '指定された組織が見つかりません。' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      hashedPassword,
      role: role === 'admin' ? 'admin' : 'member',
      organizationId,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  res.status(201).json(user);
});

// DELETE /api/organizations/:id/users/:userId — remove user (admin)
router.delete('/:id/users/:userId', requireSuperAdmin, async (req, res) => {
  const { id: organizationId, userId } = req.params;

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
  });
  if (!user) {
    return res.status(404).json({ error: 'この組織にそのユーザーは見つかりません。' });
  }

  // Prevent deleting yourself
  if (userId === req.user!.userId) {
    return res.status(400).json({ error: '自分自身を削除することはできません。' });
  }

  await prisma.user.delete({ where: { id: userId } });
  res.json({ success: true });
});

// GET /api/organizations/:id — single org detail (admin)
router.get('/:id', requireSuperAdmin, async (req, res) => {
  const { id } = req.params;
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: { select: { brands: true, users: true } },
      brands: { select: { id: true, name: true, domain: true } },
    },
  });
  if (!org) return res.status(404).json({ error: '指定された組織が見つかりません。' });
  res.json(org);
});

export default router;
