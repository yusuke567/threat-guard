import { prisma } from '../lib/prisma.js';

// ─── Police / Authority recipient constants ──────────────────────────────────
export const POLICE_RECIPIENT = {
  type: 'police' as const,
  name: '警視庁 サイバー犯罪対策課',
  email: 'cyber@keishicho.metro.tokyo.lg.jp',
};

export type RecipientType = 'registrar' | 'police';

/** Known Japanese registrars for language auto-detection */
const JAPANESE_REGISTRARS = [
  'gmo',
  'onamae',
  'お名前',
  'pepabo',
  'muumuu',
  'ムームー',
  'value-domain',
  'value domain',
  'xserver',
  'エックスサーバー',
  'sakura',
  'さくらインターネット',
  'jprs',
  'japan registry',
  'interlink',
  'gehirn',
  'conoha',
  'z.com',
  'fc2',
];

function isJapaneseRegistrar(registrar: string): boolean {
  const lower = registrar.toLowerCase();
  return JAPANESE_REGISTRARS.some((keyword) => lower.includes(keyword));
}

/**
 * Generate a takedown request template
 * Uses Claude API if ANTHROPIC_API_KEY is set, otherwise uses a rule-based template
 * Language is auto-detected from registrar (Japanese registrar → Japanese, otherwise → English)
 */
export async function generateTakedownTemplate(
  detectedDomainId: string
): Promise<{ id: string; template: string }> {
  const domain = await prisma.detectedDomain.findUniqueOrThrow({
    where: { id: detectedDomainId },
    include: {
      brand: { include: { organization: true } },
      analyses: { orderBy: { analyzedAt: 'desc' }, take: 1 },
    },
  });

  const analysis = domain.analyses[0];
  const whois = domain.whoisData ? JSON.parse(domain.whoisData) : {};
  const registrar = whois?.registrar || 'Unknown Registrar';

  let template = '';
  const useJapanese = isJapaneseRegistrar(registrar);

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic();

      const languageInstruction = useJapanese
        ? `Generate the letter entirely in Japanese. Use formal business Japanese (敬語). Address it to "不正利用対応窓口 御中".`
        : `Generate the letter entirely in English. Address it to the registrar's abuse department.`;

      const prompt = `You are a brand protection legal specialist. Generate a professional takedown request letter for the following case.

**Brand Owner:**
- Organization: ${domain.brand.organization.name}
- Brand: ${domain.brand.name}
- Legitimate Domain: ${domain.brand.domain}

**Infringing Domain:**
- Domain: ${domain.domain}
- Registrar: ${registrar}
- First Detected: ${domain.firstSeen.toISOString()}
- Threat Category: ${analysis?.category || 'suspected brand abuse'}
- Analysis: ${analysis?.reasoning || 'Domain closely resembles the legitimate brand domain'}

${languageInstruction}

The letter should:
1. Identify the brand owner and their rights
2. Describe the infringing domain and the nature of infringement
3. Cite relevant policies (UDRP, registrar AUP, ICANN policies)
4. Request immediate suspension/transfer of the domain
5. Include a deadline for response (typically 48-72 hours)

Format it as a ready-to-send email.`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      template = response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err) {
      console.error('Anthropic API failed, using fallback template:', err);
    }
  }

  if (!template) {
    const date = new Date().toISOString().split('T')[0];
    const deadline = new Date(Date.now() + 72 * 3600 * 1000).toISOString().split('T')[0];

    if (useJapanese) {
      // Japanese fallback template
      const categoryDescJa = analysis?.category === 'phishing'
        ? 'お客様を標的としたフィッシング行為'
        : analysis?.category === 'brand_abuse'
          ? '弊社ブランドの不正使用'
          : 'ブランドなりすましの疑い';
      const analysisJa = analysis?.reasoning || 'このドメインは弊社の正規ドメインに酷似しており、消費者を誤認させる形で使用されています。';

      template = `件名: 不正利用報告 / ドメイン停止要請 — ${domain.domain}

不正利用対応窓口 御中

${domain.brand.organization.name}（ブランド名「${domain.brand.name}」）を代表し、貴社サービスを通じて登録されたドメイン ${domain.domain} に関する${categoryDescJa}についてご報告いたします。

1. ブランド情報
   - ブランド名: ${domain.brand.name}
   - 正規ドメイン: ${domain.brand.domain}
   - 組織名: ${domain.brand.organization.name}

2. 不正ドメイン
   - ドメイン: ${domain.domain}
   - 初回検知日: ${domain.firstSeen.toISOString().split('T')[0]}
   - 脅威カテゴリ: ${analysis?.category || 'ブランドなりすまし'}
   - 分析結果: ${analysisJa}

3. 申立根拠
   当該ドメインは弊社の登録商標を侵害し、${categoryDescJa}に使用されています。これは以下に違反します:
   - ICANN レジストラ認定契約（第3.18条）
   - 統一ドメイン名紛争処理方針（UDRP）
   - 貴社の利用規約（AUP）
   - APWGのベストプラクティス

4. 要請事項
   以下の対応を速やかにお願いいたします:
   a) ドメイン ${domain.domain} の停止
   b) 関連する登録・ホスティング情報の保全
   c) 利用可能な登録者情報の提供

5. 回答期限
   ${deadline}（72時間以内）までにご対応をお願いいたします。

迅速なご対応をお願い申し上げます。追加の証拠や情報が必要な場合はお知らせください。

${domain.brand.organization.name}
ブランドプロテクションチーム
日付: ${date}`;
    } else {
      // English fallback template
      const categoryDesc = analysis?.category === 'phishing'
        ? 'phishing activity targeting our customers'
        : analysis?.category === 'brand_abuse'
          ? 'unauthorized use of our brand identity'
          : 'suspected brand impersonation';

      template = `Subject: Abuse Report / Takedown Request — ${domain.domain}

Dear Abuse Department,

I am writing on behalf of ${domain.brand.organization.name} ("${domain.brand.name}") to report ${categoryDesc} associated with the domain ${domain.domain}, which is registered through your services.

1. BRAND INFORMATION
   - Brand: ${domain.brand.name}
   - Legitimate Domain: ${domain.brand.domain}
   - Organization: ${domain.brand.organization.name}

2. INFRINGING DOMAIN
   - Domain: ${domain.domain}
   - First Detected: ${domain.firstSeen.toISOString().split('T')[0]}
   - Threat Type: ${analysis?.category || 'brand impersonation'}
   - Analysis: ${analysis?.reasoning || 'This domain closely resembles our legitimate brand domain and is being used in a manner that misleads consumers.'}

3. BASIS FOR COMPLAINT
   This domain infringes upon our registered trademark and is being used for ${categoryDesc}. This constitutes a violation of:
   - ICANN Registrar Accreditation Agreement (Section 3.18)
   - Uniform Domain-Name Dispute-Resolution Policy (UDRP)
   - Your Registrar's Acceptable Use Policy
   - Anti-Phishing Working Group (APWG) best practices

4. REQUESTED ACTION
   We request that you immediately:
   a) Suspend the domain ${domain.domain}
   b) Preserve all associated registration and hosting records
   c) Provide any available registrant information

5. DEADLINE
   We request a response and action within 72 hours (by ${deadline}).

We appreciate your prompt attention to this matter. Please do not hesitate to contact us if you require additional evidence or information.

Sincerely,
${domain.brand.organization.name}
Brand Protection Team
Date: ${date}`;
    }
  }

  // Save the takedown request
  const takedown = await prisma.takedownRequest.create({
    data: {
      detectedDomainId,
      recipientType: 'registrar',
      recipientName: registrar,
      registrar,
      template,
      status: 'draft',
    },
  });

  return { id: takedown.id, template };
}

/**
 * Generate a takedown request template for police (警視庁)
 * Always generates in Japanese
 */
export async function generatePoliceTemplate(
  detectedDomainId: string
): Promise<{ id: string; template: string }> {
  const domain = await prisma.detectedDomain.findUniqueOrThrow({
    where: { id: detectedDomainId },
    include: {
      brand: { include: { organization: true } },
      analyses: { orderBy: { analyzedAt: 'desc' }, take: 1 },
    },
  });

  const analysis = domain.analyses[0];
  const whois = domain.whoisData ? JSON.parse(domain.whoisData) : {};
  const registrar = whois?.registrar || '不明';

  let template = '';

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic();

      const prompt = `You are a cybercrime reporting specialist in Japan. Generate a formal information report (情報提供) to the Tokyo Metropolitan Police Department (警視庁 サイバー犯罪対策課) about a phishing/brand abuse website.

**Reporting Organization:**
- Organization: ${domain.brand.organization.name}
- Brand: ${domain.brand.name}
- Legitimate Domain: ${domain.brand.domain}

**Suspicious Domain:**
- Domain: ${domain.domain}
- Registrar: ${registrar}
- First Detected: ${domain.firstSeen.toISOString()}
- Threat Category: ${analysis?.category || 'suspected brand abuse'}
- Analysis: ${analysis?.reasoning || 'Domain closely resembles the legitimate brand domain'}

Generate the report entirely in Japanese using formal business Japanese (敬語).
The report should be addressed to "警視庁 サイバー犯罪対策課 御中".

Structure:
1. 件名（フィッシングサイトに関する情報提供）
2. 通報者情報（組織名・ブランド名・連絡先として正規ドメイン）
3. 不正サイトの情報（ドメイン名・検知日・脅威の種類・詳細分析）
4. 被害の状況・リスク（顧客の個人情報漏洩リスク等）
5. ドメイン登録情報（レジストラ・登録日等のWHOIS情報）
6. 対応のお願い（捜査・サイト閉鎖への協力依頼）
7. 添付資料の説明（スクリーンショット・WHOIS情報等を添付している旨）

Format it as a ready-to-send document body.`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }],
      });

      template = response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err) {
      console.error('Anthropic API failed for police template, using fallback:', err);
    }
  }

  if (!template) {
    const date = new Date().toISOString().split('T')[0];
    const categoryDescJa = analysis?.category === 'phishing'
      ? 'フィッシングサイト'
      : analysis?.category === 'brand_abuse'
        ? 'ブランド悪用サイト'
        : '不正サイト（ブランドなりすましの疑い）';
    const analysisJa = analysis?.reasoning || 'このドメインは弊社の正規ドメインに酷似しており、消費者を誤認させる形で使用されている疑いがあります。';

    template = `件名: ${categoryDescJa}に関する情報提供 — ${domain.domain}

警視庁 サイバー犯罪対策課 御中

下記の不正サイトについて情報提供いたします。

1. 通報者情報
   - 組織名: ${domain.brand.organization.name}
   - ブランド名: ${domain.brand.name}
   - 正規ドメイン: ${domain.brand.domain}

2. 不正サイト情報
   - 不正ドメイン: ${domain.domain}
   - 脅威の種類: ${categoryDescJa}
   - 初回検知日: ${domain.firstSeen.toISOString().split('T')[0]}
   - レジストラ: ${registrar}

3. 脅威の詳細
   ${analysisJa}

4. 被害の状況・リスク
   当該サイトは弊社のサービスを利用するお客様を標的としており、ログイン情報・個人情報・クレジットカード情報等の窃取が行われる恐れがあります。弊社正規サイトと外観が酷似しているため、一般消費者が偽サイトと判別することは困難です。

5. ドメイン登録情報
   - レジストラ: ${registrar}${whois?.creationDate ? `\n   - 登録日: ${whois.creationDate}` : ''}${whois?.registrantCountry ? `\n   - 登録者の国: ${whois.registrantCountry}` : ''}${whois?.registrantOrganization ? `\n   - 登録者組織: ${whois.registrantOrganization}` : ''}

6. 対応のお願い
   本件につきまして、捜査およびサイト閉鎖に向けたご対応をお願い申し上げます。弊社としても全面的に協力いたします。

7. 添付資料
   - 不正サイトのスクリーンショット
   - WHOIS情報
   - AI分析レポート

${domain.brand.organization.name}
ブランドプロテクションチーム
日付: ${date}`;
  }

  // Save the takedown request
  const takedown = await prisma.takedownRequest.create({
    data: {
      detectedDomainId,
      recipientType: 'police',
      recipientName: POLICE_RECIPIENT.name,
      registrar,
      abuseEmail: POLICE_RECIPIENT.email,
      template,
      language: 'ja',
      status: 'draft',
    },
  });

  return { id: takedown.id, template };
}

/**
 * Generate police template for multiple threats (batch)
 */
export async function generatePoliceTemplateBatch(
  threats: Array<{ id: string; domain: string; riskScore: number | null; analyses: any[]; brand: any }>,
): Promise<string> {
  if (threats.length === 0) return '';

  const brand = threats[0].brand;
  const org = brand.organization;

  let template = '';

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const anthropic = new Anthropic();

      const domainList = threats.map((t) => {
        const analysis = t.analyses[0];
        return `- ${t.domain} (リスクスコア: ${t.riskScore ?? 'N/A'}/100, 種別: ${analysis?.category || 'unknown'})`;
      }).join('\n');

      const prompt = `You are a cybercrime reporting specialist in Japan. Generate a formal information report (情報提供) to the Tokyo Metropolitan Police Department (警視庁 サイバー犯罪対策課) about MULTIPLE phishing/brand abuse websites.

**Reporting Organization:**
- Organization: ${org.name}
- Brand: ${brand.name}
- Legitimate Domain: ${brand.domain}

**Suspicious Domains (${threats.length} total):**
${domainList}

Generate the report entirely in Japanese using formal business Japanese (敬語).
Address it to "警視庁 サイバー犯罪対策課 御中".

Structure:
1. 件名（フィッシングサイト${threats.length}件に関する情報提供）
2. 通報者情報
3. 不正サイト一覧（全ドメインをリスト）
4. 各サイトの脅威詳細
5. 被害の状況・リスク
6. 対応のお願い
7. 添付資料の説明

Format it as a ready-to-send document body.`;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      });

      template = response.content[0].type === 'text' ? response.content[0].text : '';
    } catch (err) {
      console.error('Anthropic API failed for batch police template:', err);
    }
  }

  if (!template) {
    const date = new Date().toISOString().split('T')[0];
    const domainListText = threats.map((t) => `   - ${t.domain}（リスクスコア: ${t.riskScore ?? '未算出'}/100）`).join('\n');

    template = `件名: フィッシングサイト${threats.length}件に関する情報提供

警視庁 サイバー犯罪対策課 御中

下記の不正サイトについて情報提供いたします。

1. 通報者情報
   - 組織名: ${org.name}
   - ブランド名: ${brand.name}
   - 正規ドメイン: ${brand.domain}

2. 不正サイト一覧（${threats.length}件）
${domainListText}

3. 脅威の詳細
   上記ドメインは弊社の正規ドメイン ${brand.domain} に酷似しており、消費者を誤認させる形で使用されています。フィッシング行為およびブランドの不正使用に該当します。

4. 被害の状況・リスク
   当該サイトは弊社のサービスを利用するお客様を標的としており、ログイン情報・個人情報・クレジットカード情報等の窃取が行われる恐れがあります。

5. 対応のお願い
   本件につきまして、捜査およびサイト閉鎖に向けたご対応をお願い申し上げます。

6. 添付資料
   - 各サイトのスクリーンショット
   - WHOIS情報
   - AI分析レポート

${org.name}
ブランドプロテクションチーム
${date}`;
  }

  return template;
}
