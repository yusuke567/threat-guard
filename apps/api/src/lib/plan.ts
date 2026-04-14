/**
 * 契約プランに基づく機能ゲート判定。
 * 価格プラン定義: docs/business/pricing-plan-v2.md
 */

export const PLANS = {
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
  ENTERPRISE_PLUS: 'enterprise_plus',
} as const;

export type Plan = (typeof PLANS)[keyof typeof PLANS];

const PLAN_RANK: Record<string, number> = {
  starter: 1,
  professional: 2,
  enterprise: 3,
  enterprise_plus: 4,
};

/**
 * Professional以上か判定（JPCERT連動アラート等のPro機能用）。
 * 不明なプラン値はStarter相当（false）として安全側に倒す。
 */
export function isProOrAbove(plan: string | null | undefined): boolean {
  if (!plan) return false;
  return (PLAN_RANK[plan] ?? 0) >= PLAN_RANK.professional;
}

export function isEnterpriseOrAbove(plan: string | null | undefined): boolean {
  if (!plan) return false;
  return (PLAN_RANK[plan] ?? 0) >= PLAN_RANK.enterprise;
}
