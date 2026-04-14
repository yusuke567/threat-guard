'use client';

import { Icon } from './ui';

interface Props {
  /** 機能名（例: "JPCERT/CC連動アラート"） */
  featureName: string;
  /** 機能の説明 */
  description: string;
  /** 必要プラン表示 */
  requiredPlan?: 'Professional' | 'Enterprise';
  /** 追加クラス */
  className?: string;
}

/**
 * 上位プラン限定機能のロック表示カード。
 * Starterユーザに対するアップセル用UI。
 */
export function ProFeatureLock({
  featureName,
  description,
  requiredPlan = 'Professional',
  className = '',
}: Props) {
  return (
    <div
      className={
        'relative rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 ' +
        'bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 ' +
        'p-6 ' + className
      }
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <Icon name="lock" size={24} className="text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{featureName}</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
              {requiredPlan} 以上
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mb-3">{description}</p>
          <a
            href="https://threatguard.jp/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-500"
          >
            プランをアップグレード
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
