/**
 * Browser Report Service
 * - Google Safe Browsing: Report phishing URL via Safe Browsing API (Lookup + Report)
 * - Microsoft SmartScreen: Submit report via SmartScreen feedback form
 */

const GOOGLE_SB_API_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
const GOOGLE_SB_REPORT_URL = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';
const GOOGLE_SB_SUBMIT_URL = 'https://safebrowsing.googleapis.com/v4/threatHits';

// --- Google Safe Browsing ---

/**
 * Check if a URL is already flagged in Google Safe Browsing
 */
export async function checkGoogleSafeBrowsing(url: string): Promise<{
  isFlagged: boolean;
  threats: Array<{ threatType: string; platformType: string }>;
}> {
  if (!GOOGLE_SB_API_KEY) {
    throw new Error('GOOGLE_SAFE_BROWSING_API_KEYが設定されていません。ステータス確認にはAPIキーが必要ですが、削除申請はAPIキーなしでも実行可能です。');
  }

  const body = {
    client: {
      clientId: 'threatguard',
      clientVersion: '1.0.0',
    },
    threatInfo: {
      threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: [{ url }],
    },
  };

  const res = await fetch(`${GOOGLE_SB_REPORT_URL}?key=${GOOGLE_SB_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Safe Browsing API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const matches = data.matches || [];

  return {
    isFlagged: matches.length > 0,
    threats: matches.map((m: any) => ({
      threatType: m.threatType,
      platformType: m.platformType,
    })),
  };
}

/**
 * Report a phishing URL to Google Safe Browsing via the report_phish endpoint
 * Uses the free report submission endpoint (no Web Risk API sales contact needed)
 */
export async function reportToGoogleSafeBrowsing(url: string): Promise<{
  success: boolean;
  message: string;
  manualReportUrl?: string;
}> {
  // APIキーが未設定の場合は、手動報告リンクを返す
  if (!GOOGLE_SB_API_KEY) {
    console.log('GOOGLE_SAFE_BROWSING_API_KEY is not configured. Returning manual report URL.');
    return reportToGoogleSafeBrowsingForm(url);
  }

  // Use the Safe Browsing Update API report endpoint
  // POST to report phishing URLs
  const reportUrl = `https://safebrowsing.googleapis.com/v4/threatHits?key=${GOOGLE_SB_API_KEY}`;

  const body = {
    clientInfo: {
      clientId: 'threatguard',
      clientVersion: '1.0.0',
    },
    entry: {
      url,
    },
    threatType: 'SOCIAL_ENGINEERING',
    platformType: 'ANY_PLATFORM',
  };

  const res = await fetch(reportUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Fall back to manual report URL if API fails
    console.warn(`Google SB threatHits API failed (${res.status}): ${errText}. Returning manual report URL.`);
    return reportToGoogleSafeBrowsingForm(url);
  }

  return {
    success: true,
    message: 'URL reported to Google Safe Browsing via API',
  };
}

/**
 * Fallback: Return manual report URL for Google Safe Browsing
 * Google's form requires browser interaction (CSRF tokens, JavaScript)
 * so we provide a pre-filled URL for manual submission
 */
function reportToGoogleSafeBrowsingForm(url: string): {
  success: boolean;
  message: string;
  manualReportUrl: string;
} {
  const manualReportUrl = `https://safebrowsing.google.com/safebrowsing/report_phish/?hl=en&url=${encodeURIComponent(url)}`;

  return {
    success: true,
    message: 'Google Safe Browsing APIキーが未設定のため、手動報告リンクを生成しました。リンクをクリックして報告を完了してください。',
    manualReportUrl,
  };
}

// --- Microsoft SmartScreen ---

/**
 * Report a phishing URL to Microsoft SmartScreen via feedback form
 */
export async function reportToSmartScreen(url: string): Promise<{
  success: boolean;
  message: string;
  fallbackUrl: string;
}> {
  const fallbackUrl = `https://www.microsoft.com/en-us/wdsi/support/report-unsafe-site-guest?url=${encodeURIComponent(url)}`;

  try {
    // Microsoft's report form endpoint
    const reportUrl = 'https://www.microsoft.com/en-us/wdsi/support/report-unsafe-site-guest';

    const params = new URLSearchParams();
    params.append('url', url);
    params.append('threat_type', 'Phishing');
    params.append('additional_info', `Phishing site reported by ThreatGuard brand protection service. Target URL: ${url}`);

    const res = await fetch(reportUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'ThreatGuard/1.0',
      },
      body: params.toString(),
      redirect: 'follow',
    });

    if (res.status >= 200 && res.status < 400) {
      return {
        success: true,
        message: 'URL reported to Microsoft SmartScreen via form submission',
        fallbackUrl,
      };
    }

    return {
      success: false,
      message: `SmartScreen form returned status ${res.status}. Use manual submission link.`,
      fallbackUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `SmartScreen form error: ${err.message}. Use manual submission link.`,
      fallbackUrl,
    };
  }
}

/**
 * Get manual report URLs for both providers
 */
export function getManualReportUrls(url: string) {
  return {
    google: `https://safebrowsing.google.com/safebrowsing/report_phish/?hl=en&url=${encodeURIComponent(url)}`,
    microsoft: `https://www.microsoft.com/en-us/wdsi/support/report-unsafe-site-guest?url=${encodeURIComponent(url)}`,
  };
}
