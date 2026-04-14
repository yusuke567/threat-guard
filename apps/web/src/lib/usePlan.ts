'use client';

import { useEffect, useState } from 'react';
import { getMyOrganization } from './api';

const PLAN_RANK: Record<string, number> = {
  starter: 1,
  professional: 2,
  enterprise: 3,
  enterprise_plus: 4,
};

export type Plan = 'starter' | 'professional' | 'enterprise' | 'enterprise_plus';

export interface PlanState {
  plan: Plan | null;
  isPro: boolean;
  isEnterprise: boolean;
  organizationName: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * 現在のユーザの組織契約プランを取得し、機能ゲート判定に使う。
 * Pro+判定のみ必要なページで利用。
 */
export function usePlan(): PlanState {
  const [state, setState] = useState<PlanState>({
    plan: null,
    isPro: false,
    isEnterprise: false,
    organizationName: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    getMyOrganization()
      .then((org) => {
        if (cancelled) return;
        const plan = (org?.plan as Plan) ?? null;
        const rank = plan ? PLAN_RANK[plan] ?? 0 : 0;
        setState({
          plan,
          isPro: rank >= PLAN_RANK.professional,
          isEnterprise: rank >= PLAN_RANK.enterprise,
          organizationName: org?.name ?? null,
          loading: false,
          error: null,
        });
      })
      .catch((e: any) => {
        if (cancelled) return;
        setState((prev) => ({ ...prev, loading: false, error: e?.message || '組織情報の取得に失敗しました' }));
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}
