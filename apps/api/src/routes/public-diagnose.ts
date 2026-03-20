import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { runFreeDiagnosis } from '../services/free-diagnosis.js';

const router = Router();

const MAX_FREE_DIAGNOSES = 3;
const RESULT_TTL_DAYS = 7;

const diagnoseSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  targetUrl: z
    .string()
    .min(1, 'URLを入力してください')
    .refine(
      (val) => {
        try {
          // Accept bare domains or full URLs
          const url = val.startsWith('http') ? val : `https://${val}`;
          new URL(url);
          return true;
        } catch {
          return false;
        }
      },
      { message: '有効なURLまたはドメインを入力してください' }
    ),
});

// POST /api/public/diagnose — Start a free diagnosis
router.post('/', async (req, res) => {
  try {
    const parsed = diagnoseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    }

    const { email, targetUrl } = parsed.data;

    // Normalize URL → extract domain
    const normalizedUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
    const domain = new URL(normalizedUrl).hostname;

    // Check usage limit (non-expired diagnoses for this email)
    const usageCount = await prisma.freeDiagnosis.count({
      where: {
        email,
        expiresAt: { gt: new Date() },
      },
    });

    if (usageCount >= MAX_FREE_DIAGNOSES) {
      return res.status(429).json({
        error: '無料診断の上限（3回）に達しました。有料プランにアップグレードしてください。',
        remainingCount: 0,
        limit: MAX_FREE_DIAGNOSES,
      });
    }

    // Create diagnosis record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + RESULT_TTL_DAYS);

    const diagnosis = await prisma.freeDiagnosis.create({
      data: {
        email,
        targetUrl: normalizedUrl,
        domain,
        status: 'scanning',
        expiresAt,
      },
    });

    // Run diagnosis in background
    runFreeDiagnosis(diagnosis.id).catch((err) => {
      console.error(`Free diagnosis failed for ${diagnosis.id}:`, err);
    });

    res.status(202).json({
      id: diagnosis.id,
      status: 'scanning',
      remainingCount: MAX_FREE_DIAGNOSES - usageCount - 1,
      limit: MAX_FREE_DIAGNOSES,
    });
  } catch (err) {
    console.error('POST /api/public/diagnose error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// GET /api/public/diagnose/:id — Get diagnosis result
router.get('/:id', async (req, res) => {
  try {
    const diagnosis = await prisma.freeDiagnosis.findUnique({
      where: { id: req.params.id },
    });

    if (!diagnosis) {
      return res.status(404).json({ error: '診断結果が見つかりません' });
    }

    // Check expiry
    if (diagnosis.expiresAt < new Date()) {
      return res.status(410).json({
        error: '診断結果の保存期間が終了しました。有料プランなら無期限で保存できます。',
        expired: true,
      });
    }

    // Get remaining count for this email
    const usageCount = await prisma.freeDiagnosis.count({
      where: {
        email: diagnosis.email,
        expiresAt: { gt: new Date() },
      },
    });

    res.json({
      id: diagnosis.id,
      targetUrl: diagnosis.targetUrl,
      domain: diagnosis.domain,
      status: diagnosis.status,
      riskScore: diagnosis.riskScore,
      category: diagnosis.category,
      confidence: diagnosis.confidence,
      reasoning: diagnosis.reasoning,
      screenshotUrl: diagnosis.screenshotUrl,
      dnsResolved: diagnosis.dnsResolved,
      httpStatus: diagnosis.httpStatus,
      finalUrl: diagnosis.finalUrl,
      ip: diagnosis.ip,
      // Blurred / restricted fields for free tier
      sslInfo: diagnosis.sslInfo ? '有料プランで詳細を確認' : null,
      whoisData: diagnosis.whoisData ? '有料プランで詳細を確認' : null,
      htmlSnippet: diagnosis.htmlSnippet ? diagnosis.htmlSnippet.slice(0, 200) : null,
      error: diagnosis.error,
      expiresAt: diagnosis.expiresAt,
      createdAt: diagnosis.createdAt,
      remainingCount: MAX_FREE_DIAGNOSES - usageCount,
      limit: MAX_FREE_DIAGNOSES,
    });
  } catch (err) {
    console.error('GET /api/public/diagnose/:id error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

// GET /api/public/diagnose/check/:email — Check remaining usage
router.get('/check/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    const usageCount = await prisma.freeDiagnosis.count({
      where: {
        email,
        expiresAt: { gt: new Date() },
      },
    });

    res.json({
      remainingCount: Math.max(0, MAX_FREE_DIAGNOSES - usageCount),
      limit: MAX_FREE_DIAGNOSES,
      used: usageCount,
    });
  } catch (err) {
    console.error('GET /api/public/diagnose/check error:', err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

export default router;
