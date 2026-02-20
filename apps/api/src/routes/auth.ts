import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Login
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials' });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(parsed.data.password, user.hashedPassword);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: user.organizationId,
  });
});

// Register (for initial setup)
router.post('/register', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().optional(),
    organizationId: z.string().uuid().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      hashedPassword,
      name: parsed.data.name,
      organizationId: parsed.data.organizationId,
    },
  });

  res.status(201).json({
    id: user.id,
    email: user.email,
    name: user.name,
  });
});

export default router;
