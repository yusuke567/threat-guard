import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { getAbuseContacts, getHostingAbuseContacts } from '../services/whois-abuse.js';
import { generateTakedownTemplate, generateJpcertTemplateBatch, generateHostingTemplateBatch, JPCERT_RECIPIENT, type RecipientType } from '../services/takedown.js';
import { sendTakedownEmail, sendTakedownEmailGroup } from '../services/takedown-export.js';

const router = Router();

// Helper: get brand IDs belonging to user's org (superadmin gets all)
async function orgBrandIds(req: any): Promise<string[]> {
  if (req.user?.role === 'superadmin' && !req.user?.organizationId) {
    const brands = await prisma.brand.findMany({ select: { id: true } });
    return brands.map((b) => b.id);
  }
  const brands = await prisma.brand.findMany({
    where: { organizationId: req.user!.organizationId! },
    select: { id: true },
  });
  return brands.map((b) => b.id);
}

// ─── GET /takedown-batches/abuse-contacts ───────────────────────────────────
// Bulk lookup abuse contacts for multiple threats
router.post('/abuse-contacts', async (req, res) => {
  try {
    const schema = z.object({ threatIds: z.array(z.string().uuid()).min(1).max(100) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const brandIds = await orgBrandIds(req);
    const threats = await prisma.detectedDomain.findMany({
      where: { id: { in: parsed.data.threatIds }, brandId: { in: brandIds } },
      include: { brand: true, analyses: { orderBy: { analyzedAt: 'desc' }, take: 1 } },
    });

    const results = await Promise.all(
      threats.map(async (t) => {
        const [abuse, hostingAbuse] = await Promise.all([
          getAbuseContacts(t.id),
          getHostingAbuseContacts(t.id),
        ]);
        return {
          threatId: t.id,
          domain: t.domain,
          riskScore: t.riskScore,
          status: t.status,
          category: t.analyses[0]?.category || 'unknown',
          categoryDescription: getCategoryDescription(t.analyses[0]?.category),
          brandName: t.brand.name,
          brandDomain: t.brand.domain,
          registrar: abuse.registrar,
          abuseEmail: abuse.abuseEmail,
          source: abuse.source,
          hostingProvider: hostingAbuse.provider,
          hostingAbuseEmail: hostingAbuse.abuseEmail,
          hostingNetwork: hostingAbuse.network,
          hostingSource: hostingAbuse.source,
          screenshotUrl: t.screenshotUrl,
          whoisData: t.whoisData,
        };
      })
    );

    // Group by abuse email / registrar
    const groups: Record<string, { abuseEmail: string | null; registrar: string; threats: typeof results }> = {};
    for (const r of results) {
      const key = r.abuseEmail || `manual:${r.registrar}`;
      if (!groups[key]) {
        groups[key] = { abuseEmail: r.abuseEmail, registrar: r.registrar, threats: [] };
      }
      groups[key].threats.push(r);
    }

    // Group by hosting provider abuse email
    const hostingGroups: Record<string, { abuseEmail: string | null; registrar: string; threats: typeof results }> = {};
    for (const r of results) {
      if (r.hostingSource === 'none') continue;
      const key = r.hostingAbuseEmail || `manual:${r.hostingProvider}`;
      if (!hostingGroups[key]) {
        hostingGroups[key] = { abuseEmail: r.hostingAbuseEmail, registrar: r.hostingProvider, threats: [] };
      }
      hostingGroups[key].threats.push(r);
    }

    res.json({
      threats: results,
      groups: Object.values(groups),
      hostingGroups: Object.values(hostingGroups),
      jpcertRecipient: JPCERT_RECIPIENT,
    });
  } catch (err: any) {
    console.error('Abuse contacts lookup failed:', err);
    res.status(500).json({ error: '送信先の取得に失敗しました。' });
  }
});

// ─── POST /takedown-batches ─────────────────────────────────────────────────
// Create a batch takedown request and send emails
router.post('/', async (req, res) => {
  try {
    const itemSchema = z.object({
      threatId: z.string().uuid(),
      abuseEmail: z.string().email(),
      template: z.string().min(1),
      language: z.string().default('en'),
      evidenceTypes: z.string().default(''),
      recipientType: z.enum(['registrar', 'jpcert', 'hosting']).default('registrar'),
      recipientName: z.string().optional(),
    });
    const skippedItemSchema = z.object({
      threatId: z.string().uuid(),
      registrar: z.string(),
    });
    const schema = z.object({
      items: z.array(itemSchema).max(100).default([]),
      skippedItems: z.array(skippedItemSchema).max(100).default([]),
    }).refine((data) => data.items.length > 0 || data.skippedItems.length > 0, {
      message: '送信アイテムまたはスキップアイテムが1件以上必要です',
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const brandIds = await orgBrandIds(req);

    // Verify all threats belong to org
    const allThreatIds = [
      ...parsed.data.items.map((i) => i.threatId),
      ...parsed.data.skippedItems.map((i) => i.threatId),
    ];
    const uniqueThreatIds = [...new Set(allThreatIds)];
    const threats = await prisma.detectedDomain.findMany({
      where: { id: { in: uniqueThreatIds }, brandId: { in: brandIds } },
      include: { brand: { include: { organization: true } }, analyses: { orderBy: { analyzedAt: 'desc' }, take: 1 } },
    });
    const threatMap = new Map(threats.map((t) => [t.id, t]));

    const missingIds = uniqueThreatIds.filter((id) => !threatMap.has(id));
    if (missingIds.length > 0) {
      return res.status(404).json({ error: `脅威が見つかりません: ${missingIds.join(', ')}` });
    }

    // Create batch
    const totalCount = parsed.data.items.length + parsed.data.skippedItems.length;
    const batch = await prisma.takedownBatch.create({
      data: { totalCount, status: 'draft' },
    });

    // Create individual takedown requests
    const requests: Awaited<ReturnType<typeof prisma.takedownRequest.create>>[] = [];
    for (const item of parsed.data.items) {
      const threat = threatMap.get(item.threatId)!;
      const whois = threat.whoisData ? JSON.parse(threat.whoisData) : {};
      const registrar = whois?.registrar || 'Unknown';

      const recipientName = item.recipientType === 'jpcert'
        ? (item.recipientName || JPCERT_RECIPIENT.name)
        : item.recipientType === 'hosting'
          ? (item.recipientName || 'Hosting Provider')
          : registrar;

      const takedown = await prisma.takedownRequest.create({
        data: {
          detectedDomainId: item.threatId,
          batchId: batch.id,
          recipientType: item.recipientType,
          recipientName,
          registrar,
          abuseEmail: item.abuseEmail,
          template: item.template,
          language: item.language,
          evidenceTypes: item.evidenceTypes,
          status: 'draft',
        },
      });
      requests.push(takedown);
    }

    // Create skipped takedown requests (no_email status)
    let skippedCount = 0;
    for (const item of parsed.data.skippedItems) {
      await prisma.takedownRequest.create({
        data: {
          detectedDomainId: item.threatId,
          batchId: batch.id,
          recipientType: 'registrar',
          recipientName: item.registrar,
          registrar: item.registrar,
          abuseEmail: null,
          template: '',
          language: 'ja',
          evidenceTypes: '',
          status: 'no_email',
        },
      });
      skippedCount++;
    }

    // Send emails — JPCERT is consolidated into a single email per recipientType
    // (the batch template already lists every site); registrar/hosting remain one email per request.
    let sentCount = 0;
    const errors: { threatId: string; error: string }[] = [];

    const jpcertRequests = requests.filter((r) => r.recipientType === 'jpcert' && r.abuseEmail);
    const perDomainRequests = requests.filter(
      (r) => r.recipientType !== 'jpcert',
    );

    // Helper: send one grouped email covering all included requests
    const sendGroup = async (group: typeof requests) => {
      if (group.length === 0) return;
      const ids = group.map((r) => r.id);
      const recipient = group[0].abuseEmail!;
      try {
        await sendTakedownEmailGroup(ids, recipient);
        sentCount += group.length;
        for (const r of group) {
          await prisma.detectedDomain.update({
            where: { id: r.detectedDomainId },
            data: { status: 'takedown_sent' },
          });
        }
      } catch (err: any) {
        const msg = err?.message || String(err);
        for (const r of group) {
          errors.push({ threatId: r.detectedDomainId, error: msg });
        }
      }
    };

    await sendGroup(jpcertRequests);

    // Registrar / hosting — one email per takedown
    for (const takedownReq of perDomainRequests) {
      try {
        if (takedownReq.abuseEmail) {
          await sendTakedownEmail(takedownReq.id, takedownReq.abuseEmail);
          sentCount++;
          await prisma.detectedDomain.update({
            where: { id: takedownReq.detectedDomainId },
            data: { status: 'takedown_sent' },
          });
        }
      } catch (err: any) {
        errors.push({ threatId: takedownReq.detectedDomainId, error: err.message || String(err) });
      }
    }

    // Update batch status
    await prisma.takedownBatch.update({
      where: { id: batch.id },
      data: {
        sentCount,
        status: sentCount === requests.length ? 'sent' : sentCount > 0 ? 'partial' : 'draft',
      },
    });

    res.status(201).json({
      batchId: batch.id,
      totalCount: requests.length,
      sentCount,
      skippedCount,
      errors,
    });
  } catch (err: any) {
    console.error('Batch takedown failed:', err);
    res.status(500).json({ error: '一括削除申請の送信に失敗しました。' });
  }
});

// ─── GET /takedown-batches ──────────────────────────────────────────────────
// List all takedown requests with status tracking (progress tracking page)
router.get('/', async (req, res) => {
  try {
    const brandIds = await orgBrandIds(req);
    const { status, page = '1', pageSize = '20' } = req.query as Record<string, string>;

    const where: any = {
      detectedDomain: { brandId: { in: brandIds } },
    };
    if (status) where.status = status;

    const total = await prisma.takedownRequest.count({ where });
    const pageNum = parseInt(page) || 1;
    const size = parseInt(pageSize) || 20;

    const takedowns = await prisma.takedownRequest.findMany({
      where,
      include: {
        detectedDomain: {
          include: {
            brand: true,
            analyses: { orderBy: { analyzedAt: 'desc' }, take: 1 },
          },
        },
        batch: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * size,
      take: size,
    });

    // Group by batch + abuseEmail for display
    const grouped: Record<string, any> = {};
    for (const td of takedowns) {
      const key = td.batchId
        ? `batch:${td.batchId}:${td.abuseEmail || 'unknown'}`
        : `single:${td.id}`;
      if (!grouped[key]) {
        grouped[key] = {
          batchId: td.batchId,
          abuseEmail: td.abuseEmail,
          registrar: td.registrar,
          recipientType: td.recipientType,
          recipientName: td.recipientName,
          createdAt: td.createdAt,
          items: [],
        };
      }
      grouped[key].items.push({
        id: td.id,
        domain: td.detectedDomain.domain,
        status: td.status,
        riskScore: td.detectedDomain.riskScore,
        category: td.detectedDomain.analyses[0]?.category || 'unknown',
        brandName: td.detectedDomain.brand.name,
        sentAt: td.sentAt,
        respondedAt: td.respondedAt,
        rejectionReason: td.rejectionReason,
      });
    }

    // Summary stats
    const allTakedowns = await prisma.takedownRequest.findMany({
      where: { detectedDomain: { brandId: { in: brandIds } } },
      select: { status: true },
    });
    const summary = {
      total: allTakedowns.length,
      draft: allTakedowns.filter((t) => t.status === 'draft').length,
      sent: allTakedowns.filter((t) => t.status === 'sent').length,
      awaiting_response: allTakedowns.filter((t) => t.status === 'awaiting_response').length,
      completed: allTakedowns.filter((t) => t.status === 'completed').length,
      rejected: allTakedowns.filter((t) => t.status === 'rejected').length,
      no_email: allTakedowns.filter((t) => t.status === 'no_email').length,
    };

    res.json({
      groups: Object.values(grouped),
      summary,
      total,
      page: pageNum,
      pageSize: size,
      totalPages: Math.ceil(total / size),
    });
  } catch (err: any) {
    console.error('List takedowns failed:', err);
    res.status(500).json({ error: '削除申請一覧の取得に失敗しました。' });
  }
});

// ─── PATCH /takedown-batches/:id/status ─────────────────────────────────────
// Update individual takedown status (for tracking)
router.patch('/:id/status', async (req, res) => {
  try {
    const schema = z.object({
      status: z.enum(['draft', 'sent', 'awaiting_response', 'completed', 'rejected']),
      rejectionReason: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const brandIds = await orgBrandIds(req);
    const existing = await prisma.takedownRequest.findFirst({
      where: { id: req.params.id, detectedDomain: { brandId: { in: brandIds } } },
    });
    if (!existing) return res.status(404).json({ error: '削除申請が見つかりません。' });

    const updateData: any = { status: parsed.data.status };
    if (parsed.data.status === 'rejected') {
      updateData.rejectionReason = parsed.data.rejectionReason || null;
      updateData.respondedAt = new Date();
    }
    if (parsed.data.status === 'completed') {
      updateData.respondedAt = new Date();
      // Also update the threat status to resolved
      await prisma.detectedDomain.update({
        where: { id: existing.detectedDomainId },
        data: { status: 'resolved' },
      });
    }

    const updated = await prisma.takedownRequest.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.json(updated);
  } catch (err: any) {
    console.error('Update takedown status failed:', err);
    res.status(500).json({ error: 'ステータスの更新に失敗しました。' });
  }
});

// ─── POST /takedown-batches/generate-template ───────────────────────────────
// Generate takedown email template for a group of threats
router.post('/generate-template', async (req, res) => {
  try {
    const schema = z.object({
      threatIds: z.array(z.string().uuid()).min(1).max(50),
      abuseEmail: z.string().email(),
      registrar: z.string(),
      language: z.enum(['ja', 'en']).default('en'),
      recipientType: z.enum(['registrar', 'jpcert', 'hosting']).default('registrar'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const brandIds = await orgBrandIds(req);
    const threats = await prisma.detectedDomain.findMany({
      where: { id: { in: parsed.data.threatIds }, brandId: { in: brandIds } },
      include: {
        brand: { include: { organization: true } },
        analyses: { orderBy: { analyzedAt: 'desc' }, take: 1 },
        webProbes: { orderBy: { probeAt: 'desc' }, take: 1 },
      },
    });

    if (threats.length === 0) {
      return res.status(404).json({ error: '脅威が見つかりません。' });
    }

    const brand = threats[0].brand;
    const org = brand.organization;

    // Auto-detect language from IP geolocation if not explicitly set
    // If any domain in the group is hosted in JP, use Japanese
    if (parsed.data.language === 'en') {
      const hasJpHost = threats.some((t) => t.webProbes?.[0]?.countryCode === 'JP');
      if (hasJpHost) {
        parsed.data.language = 'ja';
      }
    }

    // JPCERT template uses JPCERT's official format
    if (parsed.data.recipientType === 'jpcert') {
      const jpcertTemplate = await generateJpcertTemplateBatch(threats as any, req.user?.name || undefined);
      return res.json({ template: jpcertTemplate, language: 'ja' });
    }

    // Hosting provider template
    if (parsed.data.recipientType === 'hosting') {
      const hostingTemplate = await generateHostingTemplateBatch(threats as any, parsed.data.registrar, req.user?.name || undefined);
      return res.json({ template: hostingTemplate, language: parsed.data.language });
    }

    const useJapanese = parsed.data.language === 'ja';

    let template = '';

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const { default: Anthropic } = await import('@anthropic-ai/sdk');
        const anthropic = new Anthropic();

        const domainList = threats.map((t) => {
          const analysis = t.analyses[0];
          return `- ${t.domain} (Risk: ${t.riskScore ?? 'N/A'}/100, Category: ${analysis?.category || 'unknown'})`;
        }).join('\n');

        const languageInstruction = useJapanese
          ? `Generate the letter entirely in Japanese. Use formal business Japanese (敬語). Address it to "不正利用対応窓口 御中".`
          : `Generate the letter entirely in English. Address it to the registrar's abuse department.`;

        const prompt = `You are a brand protection legal specialist. Generate a professional takedown request letter for MULTIPLE infringing domains.

**Brand Owner:**
- Organization: ${org.name}
- Brand: ${brand.name}
- Legitimate Domain: ${brand.domain}

**Infringing Domains (${threats.length} total):**
${domainList}

**Registrar/Hosting:** ${parsed.data.registrar}
**Abuse Contact:** ${parsed.data.abuseEmail}

${languageInstruction}

The letter should:
1. Identify the brand owner and their rights
2. List ALL infringing domains together
3. Describe the nature of infringement for each
4. Cite relevant policies (UDRP, registrar AUP, ICANN policies)
5. Request immediate suspension of all listed domains
6. Include a deadline for response (48-72 hours)

Format it as a ready-to-send email body (no Subject line needed).`;

        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 3000,
          messages: [{ role: 'user', content: prompt }],
        });

        template = response.content[0].type === 'text' ? response.content[0].text : '';
      } catch (err) {
        console.error('Anthropic API failed, using fallback:', err);
      }
    }

    if (!template) {
      // Fallback template
      const date = new Date().toISOString().split('T')[0];
      const deadline = new Date(Date.now() + 72 * 3600 * 1000).toISOString().split('T')[0];
      const domainListText = threats.map((t) => `   - ${t.domain}`).join('\n');

      if (useJapanese) {
        template = `不正利用対応窓口 御中

${org.name}（ブランド名「${brand.name}」、正規ドメイン: ${brand.domain}）を代表し、貴社サービスを通じて登録された以下のドメインに関する不正利用についてご報告いたします。

■ 不正ドメイン一覧（${threats.length}件）
${domainListText}

■ 申立内容
上記ドメインは弊社の正規ドメイン ${brand.domain} に酷似しており、消費者を誤認させる形で使用されています。これはフィッシング行為およびブランドの不正使用に該当します。

■ 申立根拠
- ICANN レジストラ認定契約（第3.18条）
- 統一ドメイン名紛争処理方針（UDRP）
- 貴社の利用規約（AUP）

■ 要請事項
上記ドメインの即時停止をお願いいたします。

■ 回答期限
${deadline}（72時間以内）

追加の証拠が必要な場合はお知らせください。

${org.name}
ブランドプロテクションチーム
${date}`;
      } else {
        template = `Dear Abuse Department,

I am writing on behalf of ${org.name} ("${brand.name}", legitimate domain: ${brand.domain}) to report brand impersonation associated with the following domains registered through your services.

INFRINGING DOMAINS (${threats.length} total):
${domainListText}

These domains closely resemble our legitimate brand domain and are being used to mislead consumers through phishing and brand abuse.

BASIS FOR COMPLAINT:
- ICANN Registrar Accreditation Agreement (Section 3.18)
- Uniform Domain-Name Dispute-Resolution Policy (UDRP)
- Your Registrar's Acceptable Use Policy

REQUESTED ACTION:
We request immediate suspension of all listed domains.

DEADLINE:
We request a response within 72 hours (by ${deadline}).

Please contact us if you require additional evidence.

Sincerely,
${org.name}
Brand Protection Team
${date}`;
      }
    }

    res.json({ template, language: parsed.data.language });
  } catch (err: any) {
    console.error('Template generation failed:', err);
    res.status(500).json({ error: 'テンプレートの生成に失敗しました。' });
  }
});

// ─── POST /takedown-batches/:id/resend ──────────────────────────────────────
// Resend a rejected takedown with updated template
router.post('/:id/resend', async (req, res) => {
  try {
    const schema = z.object({
      template: z.string().min(1),
      language: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const brandIds = await orgBrandIds(req);
    const existing = await prisma.takedownRequest.findFirst({
      where: { id: req.params.id, detectedDomain: { brandId: { in: brandIds } } },
    });
    if (!existing) return res.status(404).json({ error: '削除申請が見つかりません。' });

    // Update template and resend
    await prisma.takedownRequest.update({
      where: { id: req.params.id },
      data: {
        template: parsed.data.template,
        language: parsed.data.language || existing.language,
        status: 'draft',
        respondedAt: null,
        rejectionReason: null,
      },
    });

    if (existing.abuseEmail) {
      await sendTakedownEmail(req.params.id, existing.abuseEmail);
    }

    // Update threat status
    await prisma.detectedDomain.update({
      where: { id: existing.detectedDomainId },
      data: { status: 'takedown_sent' },
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Resend failed:', err);
    res.status(500).json({ error: '再送信に失敗しました。' });
  }
});

function getCategoryDescription(category: string | undefined): string {
  const map: Record<string, string> = {
    phishing: 'フィッシングサイト',
    brand_abuse: 'ブランド悪用',
    parked: 'パークドメイン',
    legitimate: '正規サイト',
    unknown: '不明',
  };
  return map[category || 'unknown'] || '不明';
}

export default router;
