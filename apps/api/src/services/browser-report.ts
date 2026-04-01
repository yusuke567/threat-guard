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
 * Note: This function requires an API key (form-based check is not available)
 */
export async function checkGoogleSafeBrowsing(url: string): Promise<{
  isFlagged: boolean;
  threats: Array<{ threatType: string; platformType: string }>;
}> {
  if (!GOOGLE_SB_API_KEY) {
    throw new Error('Safe Browsingステータスの確認にはGOOGLE_SAFE_BROWSING_API_KEYの設定が必要です。申請のみ可能です。');
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
 * Falls back to form-based submission if API key is not configured
 */
export async function reportToGoogleSafeBrowsing(url: string): Promise<{
  success: boolean;
  message: string;
}> {
  // If API key is not configured, use form-based submission directly
  if (!GOOGLE_SB_API_KEY) {
    console.info('GOOGLE_SAFE_BROWSING_API_KEY not configured, using form-based submission.');
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
    // Fall back to form-based report if API fails
    console.warn(`Google SB threatHits API failed (${res.status}): ${errText}. Falling back to report form.`);
    return reportToGoogleSafeBrowsingForm(url);
  }

  return {
    success: true,
    message: 'URL reported to Google Safe Browsing via API',
  };
}

/**
 * Fallback: Report via Google Safe Browsing phishing report form
 * POST to safebrowsing.google.com/safebrowsing/report_phish/
 */
async function reportToGoogleSafeBrowsingForm(url: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const formUrl = 'https://safebrowsing.google.com/safebrowsing/report_phish/?hl=en';

    const params = new URLSearchParams();
    params.append('url', url);
    params.append('dq', ''); // description field

    const res = await fetch(formUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'ThreatGuard/1.0',
      },
      body: params.toString(),
    });

    // Google's form returns 200 even on submission
    if (res.status >= 200 && res.status < 400) {
      return {
        success: true,
        message: 'URL reported to Google Safe Browsing via phishing report form',
      };
    }

    return {
      success: false,
      message: `Google report form returned status ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Google report form error: ${err.message}`,
    };
  }
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
