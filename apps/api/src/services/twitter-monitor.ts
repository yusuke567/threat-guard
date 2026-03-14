import { prisma } from '../lib/prisma.js';
import { notifyNewThreat } from './slack-notifier.js';
import { emailNotifyNewThreat } from './email-notifier.js';

const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const TWITTER_API_BASE = 'https://api.twitter.com/2';

interface TwitterTweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  entities?: {
    urls?: Array<{
      expanded_url: string;
      display_url: string;
    }>;
  };
}

interface TwitterUser {
  id: string;
  username: string;
  name: string;
}

interface TwitterSearchResponse {
  data?: TwitterTweet[];
  includes?: {
    users?: TwitterUser[];
  };
  meta?: {
    result_count: number;
    next_token?: string;
  };
}

/**
 * Search Twitter for recent tweets containing the given query.
 */
async function searchTwitter(query: string, maxResults = 100): Promise<TwitterSearchResponse | null> {
  if (!TWITTER_BEARER_TOKEN) {
    console.warn('[TwitterMonitor] TWITTER_BEARER_TOKEN not set, skipping.');
    return null;
  }

  const params = new URLSearchParams({
    query,
    max_results: String(Math.min(maxResults, 100)),
    'tweet.fields': 'created_at,entities,author_id',
    expansions: 'author_id',
    'user.fields': 'username,name',
  });

  try {
    const res = await fetch(`${TWITTER_API_BASE}/tweets/search/recent?${params}`, {
      headers: {
        Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`,
      },
    });

    if (res.status === 429) {
      const resetAt = res.headers.get('x-rate-limit-reset');
      console.warn(`[TwitterMonitor] Rate limited. Reset at: ${resetAt ? new Date(Number(resetAt) * 1000).toISOString() : 'unknown'}`);
      return null;
    }

    if (!res.ok) {
      const body = await res.text();
      console.error(`[TwitterMonitor] API error ${res.status}: ${body}`);
      return null;
    }

    return (await res.json()) as TwitterSearchResponse;
  } catch (err) {
    console.error('[TwitterMonitor] Fetch error:', err);
    return null;
  }
}

/**
 * Extract all URLs from a tweet (from entities or text fallback).
 */
function extractUrls(tweet: TwitterTweet): string[] {
  const urls: string[] = [];

  if (tweet.entities?.urls) {
    for (const u of tweet.entities.urls) {
      urls.push(u.expanded_url);
    }
  }

  // Fallback: extract URLs from text
  if (urls.length === 0) {
    const urlRegex = /https?:\/\/[^\s)]+/g;
    const matches = tweet.text.match(urlRegex);
    if (matches) urls.push(...matches);
  }

  return urls;
}

/**
 * Extract domain from a URL.
 */
function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Monitor Twitter for phishing URL mentions across all brands.
 * Returns the total number of new social posts saved.
 */
export async function monitorTwitter(): Promise<number> {
  if (!TWITTER_BEARER_TOKEN) {
    console.log('[TwitterMonitor] Skipped: TWITTER_BEARER_TOKEN not configured.');
    return 0;
  }

  console.log(`[TwitterMonitor] Starting monitoring cycle at ${new Date().toISOString()}`);

  // Get all brands with high-risk detected domains (riskScore >= 60)
  const brands = await prisma.brand.findMany({
    include: {
      detectedDomains: {
        where: { riskScore: { gte: 60 } },
        select: { domain: true, riskScore: true },
      },
    },
  });

  let totalSaved = 0;

  for (const brand of brands) {
    if (brand.detectedDomains.length === 0) continue;

    // Build search queries (batch domains to avoid too many API calls)
    // Twitter search allows OR queries: "domain1 OR domain2 OR domain3"
    const domains = brand.detectedDomains.map((d) => d.domain);
    const domainRiskMap = new Map(brand.detectedDomains.map((d) => [d.domain, d.riskScore ?? 60]));

    // Twitter query max is ~512 chars, batch accordingly
    const batches: string[][] = [];
    let currentBatch: string[] = [];
    let currentLength = 0;

    for (const domain of domains) {
      const addition = currentBatch.length === 0 ? domain.length : ` OR ${domain}`.length + domain.length;
      if (currentLength + addition > 450 && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [domain];
        currentLength = domain.length;
      } else {
        currentBatch.push(domain);
        currentLength += addition;
      }
    }
    if (currentBatch.length > 0) batches.push(currentBatch);

    for (const batch of batches) {
      const query = batch.join(' OR ');
      console.log(`[TwitterMonitor] Searching for brand "${brand.name}": ${query}`);

      const result = await searchTwitter(query);
      if (!result?.data) continue;

      // Build user lookup map
      const userMap = new Map<string, TwitterUser>();
      if (result.includes?.users) {
        for (const user of result.includes.users) {
          userMap.set(user.id, user);
        }
      }

      for (const tweet of result.data) {
        const urls = extractUrls(tweet);
        const matchedDomains = urls
          .map(extractDomain)
          .filter((d): d is string => d !== null)
          .filter((d) => batch.some((bd) => d === bd || d.endsWith(`.${bd}`)));

        if (matchedDomains.length === 0) continue;

        const matchedDomain = matchedDomains[0];
        const author = tweet.author_id ? userMap.get(tweet.author_id) : undefined;
        const riskScore = domainRiskMap.get(matchedDomain) ?? 60;

        try {
          // Upsert to avoid duplicates
          const saved = await prisma.socialPost.upsert({
            where: {
              platform_postId: {
                platform: 'twitter',
                postId: tweet.id,
              },
            },
            create: {
              platform: 'twitter',
              postId: tweet.id,
              authorHandle: author?.username ?? null,
              authorName: author?.name ?? null,
              content: tweet.text,
              urls: urls.join(','),
              matchedDomain,
              brandId: brand.id,
              riskScore,
              status: 'new',
              postedAt: tweet.created_at ? new Date(tweet.created_at) : null,
            },
            update: {
              // Don't overwrite existing records
            },
          });

          // Only notify if this is a new record (createdAt ~= now)
          const isNew = Date.now() - saved.createdAt.getTime() < 5000;
          if (isNew) {
            totalSaved++;

            // Slack notification
            await notifyNewThreat({
              brandId: brand.id,
              brandName: brand.name,
              domain: matchedDomain,
              riskScore,
              category: 'SNS拡散',
              source: `Twitter (@${author?.username ?? 'unknown'})`,
            });

            // Email notification
            try {
              // Find detectedDomain ID for the matched domain
              const detectedDomain = await prisma.detectedDomain.findFirst({
                where: { brandId: brand.id, domain: matchedDomain },
                select: { id: true },
              });

              if (detectedDomain) {
                await emailNotifyNewThreat({
                  brandId: brand.id,
                  brandName: brand.name,
                  domain: matchedDomain,
                  detectedDomainId: detectedDomain.id,
                  riskScore,
                  category: 'SNS拡散',
                  source: `Twitter (@${author?.username ?? 'unknown'})`,
                });
              }
            } catch (emailErr) {
              console.error(`[TwitterMonitor] Email notification failed:`, emailErr);
            }
          }
        } catch (err) {
          console.error(`[TwitterMonitor] Failed to save tweet ${tweet.id}:`, err);
        }
      }

      // Rate limit: wait 2s between batches
      if (batches.length > 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  console.log(`[TwitterMonitor] Cycle complete: ${totalSaved} new posts saved.`);
  return totalSaved;
}
