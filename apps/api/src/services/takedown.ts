import { prisma } from '../lib/prisma.js';

// ─── Police / Authority recipient constants ──────────────────────────────────
export const POLICE_RECIPIENT = {
  type: 'police' as const,
  name: '警視庁 サイバー犯罪対策課',
  email: 'cyber@keishicho.metro.tokyo.lg.jp',
};

export const JPCERT_RECIPIENT = {
  type: 'jpcert' as const,
  name: 'JPCERT/CC',
  email: 'info@jpcert.or.jp',
  pgpKeyUrl: 'https://www.jpcert.or.jp/keys/info-0x69ECE048.asc',
};

export type RecipientType = 'registrar' | 'police' | 'jpcert';

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
      webProbes: { orderBy: { probeAt: 'desc' }, take: 1 },
    },
  });

  const analysis = domain.analyses[0];
  const whois = domain.whoisData ? JSON.parse(domain.whoisData) : {};
  const registrar = whois?.registrar || 'Unknown Registrar';
  const latestProbe = domain.webProbes?.[0];

  let template = '';
  // IP geolocation (JP) → Japanese, otherwise → English, fallback to registrar name check
  const useJapanese = latestProbe?.countryCode
    ? latestProbe.countryCode === 'JP'
    : isJapaneseRegistrar(registrar);

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
  detectedDomainId: string,
  userName?: string
): Promise<{ id: string; template: string }> {
  const domain = await prisma.detectedDomain.findUniqueOrThrow({
    where: { id: detectedDomainId },
    include: {
      brand: { include: { organization: true } },
      analyses: { orderBy: { analyzedAt: 'desc' }, take: 1 },
      webProbes: { orderBy: { probeAt: 'desc' }, take: 1 },
    },
  });

  const analysis = domain.analyses[0];
  const webProbe = domain.webProbes[0];
  const whois = domain.whoisData ? JSON.parse(domain.whoisData) : {};
  const registrar = whois?.registrar || '不明';

  const reportDate = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' JST';
  const discoveryDate = domain.firstSeen.toISOString().replace('T', ' ').slice(0, 19) + ' JST';
  const siteStatus = webProbe?.httpStatus ? `稼働中 (HTTP ${webProbe.httpStatus})` : '確認中';
  const riskScoreText = domain.riskScore !== null ? `${domain.riskScore}/100` : '未算出';
  const categoryText = analysis?.category === 'phishing'
    ? 'フィッシング'
    : analysis?.category === 'brand_abuse'
      ? 'ブランド悪用'
      : '不正サイト';

  const template = `ご担当者様

当社を偽るフィッシングサイトを検出いたしました。
削除をお願いいたします。

**フィッシングサイト報告書**

**1. 連絡先**

- 報告者名：${userName || ''}
- 所属組織：${domain.brand.organization.name}
- メールアドレス：${domain.brand.senderEmail || ''}
- 報告日時：${reportDate}

**2. インシデントの情報**

**対象フィッシングサイト一覧：**

**サイト1**

- 悪用URL：https://${domain.domain}/
- IPアドレス：${webProbe?.ip || '不明'}
- 発見日時：${discoveryDate}
- サイトの状態：${siteStatus}
- リスクスコア：${riskScoreText}
- 攻撃種別：${categoryText}
- 詳細：当社ブランドを悪用した偽装サイト

**3. 偽装対象の正規サイト情報**

- 被害組織：${domain.brand.organization.name}
- 正規ドメイン：https://${domain.brand.domain}/
- ブランド名：${domain.brand.name}

**4. その他関連情報**

- **発見方法：** 社内セキュリティ監視システムによる検知
- **被害状況：** 調査中
- **対処状況：**
    - 社内関係部署への緊急連絡完了
    - 顧客への注意喚起準備中
- **追加情報：**
    - 当該サイトは当社の正規サイトデザインを模倣
    - 顧客の個人情報及び取引情報の窃取が目的と推定
    - 継続監視が必要な状況

**報告者署名：**
${domain.brand.organization.name}・${userName || ''}`;

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
 * Uses a fixed template format without AI generation
 */
export async function generatePoliceTemplateBatch(
  threats: Array<{ id: string; domain: string; riskScore: number | null; analyses: any[]; brand: any; webProbes?: any[]; firstSeen?: Date }>,
  userName?: string,
): Promise<string> {
  if (threats.length === 0) return '';

  const brand = threats[0].brand;
  const org = brand.organization;

  const reportDate = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' JST';

  const sitesList = threats.map((t, index) => {
    const analysis = t.analyses[0];
    const webProbe = t.webProbes?.[0];
    const discoveryDate = t.firstSeen
      ? new Date(t.firstSeen).toISOString().replace('T', ' ').slice(0, 19) + ' JST'
      : '不明';
    const siteStatus = webProbe?.httpStatus ? `稼働中 (HTTP ${webProbe.httpStatus})` : '確認中';
    const riskScoreText = t.riskScore !== null ? `${t.riskScore}/100` : '未算出';
    const categoryText = analysis?.category === 'phishing'
      ? 'フィッシング'
      : analysis?.category === 'brand_abuse'
        ? 'ブランド悪用'
        : '不正サイト';

    return `**サイト${index + 1}**

- 悪用URL：https://${t.domain}/
- IPアドレス：${webProbe?.ip || '不明'}
- 発見日時：${discoveryDate}
- サイトの状態：${siteStatus}
- リスクスコア：${riskScoreText}
- 攻撃種別：${categoryText}
- 詳細：当社ブランドを悪用した偽装サイト`;
  }).join('\n\n');

  const template = `ご担当者様

当社を偽るフィッシングサイトを検出いたしました。
削除をお願いいたします。

**フィッシングサイト報告書**

**1. 連絡先**

- 報告者名：${userName || ''}
- 所属組織：${org.name}
- メールアドレス：${brand.senderEmail || ''}
- 報告日時：${reportDate}

**2. インシデントの情報**

**対象フィッシングサイト一覧：**

${sitesList}

**3. 偽装対象の正規サイト情報**

- 被害組織：${org.name}
- 正規ドメイン：https://${brand.domain}/
- ブランド名：${brand.name}

**4. その他関連情報**

- **発見方法：** 社内セキュリティ監視システムによる検知
- **被害状況：** 調査中
- **対処状況：**
    - 社内関係部署への緊急連絡完了
    - 顧客への注意喚起準備中
- **追加情報：**
    - 当該サイトは当社の正規サイトデザインを模倣
    - 顧客の個人情報及び取引情報の窃取が目的と推定
    - 継続監視が必要な状況

**報告者署名：**
${org.name}・${userName || ''}`;

  return template;
}

/**
 * Generate a takedown request template for JPCERT/CC
 * Uses a fixed template format without AI generation
 */
export async function generateJpcertTemplate(
  detectedDomainId: string,
  userName?: string
): Promise<{ id: string; template: string }> {
  const domain = await prisma.detectedDomain.findUniqueOrThrow({
    where: { id: detectedDomainId },
    include: {
      brand: { include: { organization: true } },
      analyses: { orderBy: { analyzedAt: 'desc' }, take: 1 },
      webProbes: { orderBy: { probeAt: 'desc' }, take: 1 },
    },
  });

  const analysis = domain.analyses[0];
  const webProbe = domain.webProbes[0];
  const whois = domain.whoisData ? JSON.parse(domain.whoisData) : {};
  const registrar = whois?.registrar || '不明';

  const reportDate = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' JST';
  const discoveryDate = domain.firstSeen.toISOString().replace('T', ' ').slice(0, 19) + ' JST';
  const siteStatus = webProbe?.httpStatus ? `稼働中 (HTTP ${webProbe.httpStatus})` : '確認中';
  const riskScoreText = domain.riskScore !== null ? `${domain.riskScore}/100` : '未算出';
  const categoryText = analysis?.category === 'phishing'
    ? 'フィッシング'
    : analysis?.category === 'brand_abuse'
      ? 'ブランド悪用'
      : '不正サイト';

  const template = `ご担当者様

当社を偽るフィッシングサイトを検出いたしました。
削除をお願いいたします。

**フィッシングサイト報告書**

**1. 連絡先**

- 報告者名：${userName || ''}
- 所属組織：${domain.brand.organization.name}
- メールアドレス：${domain.brand.senderEmail || ''}
- 報告日時：${reportDate}

**2. インシデントの情報**

**対象フィッシングサイト一覧：**

**サイト1**

- 悪用URL：https://${domain.domain}/
- IPアドレス：${webProbe?.ip || '不明'}
- 発見日時：${discoveryDate}
- サイトの状態：${siteStatus}
- リスクスコア：${riskScoreText}
- 攻撃種別：${categoryText}
- 詳細：当社ブランドを悪用した偽装サイト

**3. 偽装対象の正規サイト情報**

- 被害組織：${domain.brand.organization.name}
- 正規ドメイン：https://${domain.brand.domain}/
- ブランド名：${domain.brand.name}

**4. その他関連情報**

- **発見方法：** 社内セキュリティ監視システムによる検知
- **被害状況：** 調査中
- **対処状況：**
    - 社内関係部署への緊急連絡完了
    - 顧客への注意喚起準備中
- **追加情報：**
    - 当該サイトは当社の正規サイトデザインを模倣
    - 顧客の個人情報及び取引情報の窃取が目的と推定
    - 継続監視が必要な状況

**報告者署名：**
${domain.brand.organization.name}・${userName || ''}`;

  // Save the takedown request
  const takedown = await prisma.takedownRequest.create({
    data: {
      detectedDomainId,
      recipientType: 'jpcert',
      recipientName: JPCERT_RECIPIENT.name,
      registrar,
      abuseEmail: JPCERT_RECIPIENT.email,
      template,
      language: 'ja',
      status: 'draft',
    },
  });

  return { id: takedown.id, template };
}

/**
 * Generate JPCERT template for multiple threats (batch)
 * Uses a fixed template format without AI generation
 */
export async function generateJpcertTemplateBatch(
  threats: Array<{ id: string; domain: string; riskScore: number | null; analyses: any[]; brand: any; webProbes?: any[]; firstSeen?: Date }>,
  userName?: string,
): Promise<string> {
  if (threats.length === 0) return '';

  const brand = threats[0].brand;
  const org = brand.organization;

  const reportDate = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' JST';

  const sitesList = threats.map((t, index) => {
    const analysis = t.analyses[0];
    const webProbe = t.webProbes?.[0];
    const discoveryDate = t.firstSeen
      ? new Date(t.firstSeen).toISOString().replace('T', ' ').slice(0, 19) + ' JST'
      : '不明';
    const siteStatus = webProbe?.httpStatus ? `稼働中 (HTTP ${webProbe.httpStatus})` : '確認中';
    const riskScoreText = t.riskScore !== null ? `${t.riskScore}/100` : '未算出';
    const categoryText = analysis?.category === 'phishing'
      ? 'フィッシング'
      : analysis?.category === 'brand_abuse'
        ? 'ブランド悪用'
        : '不正サイト';

    return `**サイト${index + 1}**

- 悪用URL：https://${t.domain}/
- IPアドレス：${webProbe?.ip || '不明'}
- 発見日時：${discoveryDate}
- サイトの状態：${siteStatus}
- リスクスコア：${riskScoreText}
- 攻撃種別：${categoryText}
- 詳細：当社ブランドを悪用した偽装サイト`;
  }).join('\n\n');

  const template = `ご担当者様

当社を偽るフィッシングサイトを検出いたしました。
削除をお願いいたします。

**フィッシングサイト報告書**

**1. 連絡先**

- 報告者名：${userName || ''}
- 所属組織：${org.name}
- メールアドレス：${brand.senderEmail || ''}
- 報告日時：${reportDate}

**2. インシデントの情報**

**対象フィッシングサイト一覧：**

${sitesList}

**3. 偽装対象の正規サイト情報**

- 被害組織：${org.name}
- 正規ドメイン：https://${brand.domain}/
- ブランド名：${brand.name}

**4. その他関連情報**

- **発見方法：** 社内セキュリティ監視システムによる検知
- **被害状況：** 調査中
- **対処状況：**
    - 社内関係部署への緊急連絡完了
    - 顧客への注意喚起準備中
- **追加情報：**
    - 当該サイトは当社の正規サイトデザインを模倣
    - 顧客の個人情報及び取引情報の窃取が目的と推定
    - 継続監視が必要な状況

**報告者署名：**
${org.name}・${userName || ''}`;

  return template;
}
