<script setup lang="ts">
import { ref, computed } from 'vue'

interface ChangeItem {
  type: 'feature' | 'improvement' | 'fix' | 'breaking'
  title: string
  details: string[]
}

interface ChangelogEntry {
  date: string
  title: string
  version: string
  changes: ChangeItem[]
}

const typeLabels: Record<string, string> = {
  feature: 'New',
  improvement: 'Improved',
  fix: 'Fix',
  breaking: 'Breaking',
}

const typeIcons: Record<string, string> = {
  feature: '✦',
  improvement: '▲',
  fix: '●',
  breaking: '⚠',
}

const activeFilter = ref('all')
const filters = ['all', 'feature', 'improvement', 'fix']
const filterLabels: Record<string, string> = {
  all: 'All Updates',
  feature: 'New Features',
  improvement: 'Improvements',
  fix: 'Bug Fixes',
}

const entries: ChangelogEntry[] = [
  {
    date: '2026-04-07',
    title: 'ドキュメント v5 アップデート',
    version: 'v5.0',
    changes: [
      {
        type: 'feature',
        title: '新規ドキュメント 7ページ追加',
        details: [
          'SNS監視機能ガイド',
          'フィッシングパターンレポート',
          '通知設定マニュアル',
          '無料診断ツール解説',
          '一括テイクダウン手順',
          '組織管理ガイド',
          'APIリファレンス完全版',
        ],
      },
      {
        type: 'improvement',
        title: '技術精度の向上',
        details: [
          'ドメインスキャン: CTログソースの詳細を追記',
          'リスクスコアリング: アルゴリズムの精度改善を反映',
          '画像類似度検知: pHashからMAEベースへの移行を文書化',
          'テイクダウン手続き: 最新のプロセスフローに更新',
        ],
      },
      {
        type: 'improvement',
        title: 'システムアーキテクチャ文書の拡充',
        details: [
          '実際のテックスタック詳細を追加',
          'インフラ構成図の更新',
          'データフローの可視化',
        ],
      },
    ],
  },
  {
    date: '2026-03-25',
    title: 'ブラウザレベル削除対応',
    version: 'v4.0',
    changes: [
      {
        type: 'feature',
        title: 'Google Chrome 削除リクエスト',
        details: [
          'フィッシング警告をChrome上で直接表示',
          'Safe Browsing APIとの連携',
          '自動通報フローの実装',
        ],
      },
      {
        type: 'feature',
        title: 'Microsoft Edge SmartScreen 削除リクエスト',
        details: [
          'Edge SmartScreenへの削除申請機能',
          'ブラウザ横断でのフィッシング警告表示',
          'レポートステータスのリアルタイム追跡',
        ],
      },
      {
        type: 'improvement',
        title: 'ドキュメント整備',
        details: [
          '新機能に対応した複数ページの更新',
          '操作手順のスクリーンショット追加',
        ],
      },
    ],
  },
  {
    date: '2026-03-19',
    title: 'ユーザー管理と監視機能の強化',
    version: 'v3.0',
    changes: [
      {
        type: 'feature',
        title: '招待ベースのユーザー登録',
        details: [
          '組織招待によるセキュアなオンボーディング',
          '商標関連文書のアップロード機能',
          'セットアップチェックリストの導入',
        ],
      },
      {
        type: 'feature',
        title: 'リアルタイム監視ステータス表示',
        details: [
          '監視状況のリアルタイムダッシュボード',
          'スクリーンショット比較機能',
          'ステータス変更履歴の追跡',
        ],
      },
      {
        type: 'improvement',
        title: 'ドメイン管理の2層システム',
        details: [
          'プライマリ/セカンダリドメインの階層管理',
          'ダークモード対応',
          '一括削除リクエスト機能',
        ],
      },
      {
        type: 'fix',
        title: 'メールインフラの改善',
        details: [
          'Resend APIへの移行',
          'メール配信の信頼性向上',
          'テンプレートシステムの刷新',
        ],
      },
    ],
  },
  {
    date: '2026-03-05',
    title: 'ドキュメントサイト初回リリース',
    version: 'v1.0',
    changes: [
      {
        type: 'feature',
        title: 'VitePressによる包括的ドキュメント',
        details: [
          '16ページの詳細なドキュメントサイトを公開',
          '機能ガイド・技術詳細・料金プランを網羅',
          'レスポンシブデザイン対応',
          'ローカル検索機能の実装',
        ],
      },
      {
        type: 'improvement',
        title: 'セキュリティレビュー対応',
        details: [
          'セキュリティ観点でのドキュメント整備',
          'API連携ガイドの公開',
          'アーキテクチャドキュメントの作成',
        ],
      },
    ],
  },
]

const filteredEntries = computed(() => {
  if (activeFilter.value === 'all') return entries
  return entries
    .map((entry) => ({
      ...entry,
      changes: entry.changes.filter((c) => c.type === activeFilter.value),
    }))
    .filter((entry) => entry.changes.length > 0)
})

const stats = {
  pages: 23,
  updates: entries.length,
  features: entries.reduce(
    (sum, e) => sum + e.changes.filter((c) => c.type === 'feature').length,
    0
  ),
}
</script>

<template>
  <div class="changelog-page">
    <!-- Hero -->
    <div class="changelog-hero">
      <h1>Changelog</h1>
      <p class="hero-subtitle">
        ThreatGuard プロダクト・ドキュメントの更新履歴
      </p>
    </div>

    <!-- Stats -->
    <div class="changelog-stats">
      <div class="stat-item">
        <div class="stat-number">{{ stats.pages }}</div>
        <div class="stat-label">ドキュメント</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">{{ stats.updates }}</div>
        <div class="stat-label">アップデート</div>
      </div>
      <div class="stat-item">
        <div class="stat-number">{{ stats.features }}</div>
        <div class="stat-label">新機能</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="changelog-filters">
      <button
        v-for="f in filters"
        :key="f"
        :class="['filter-pill', { active: activeFilter === f }]"
        @click="activeFilter = f"
      >
        {{ filterLabels[f] }}
      </button>
    </div>

    <!-- Timeline -->
    <div class="changelog-timeline">
      <div
        v-for="entry in filteredEntries"
        :key="entry.version"
        class="changelog-entry"
      >
        <div class="entry-header">
          <div class="entry-date">{{ entry.date }}</div>
          <h2 class="entry-title">{{ entry.title }}</h2>
          <span class="entry-version">{{ entry.version }}</span>
        </div>

        <div class="change-cards">
          <div
            v-for="(change, i) in entry.changes"
            :key="i"
            class="change-card"
          >
            <div class="change-card-header">
              <span :class="['change-type', change.type]">
                {{ typeIcons[change.type] }} {{ typeLabels[change.type] }}
              </span>
              <h3 class="change-card-title">{{ change.title }}</h3>
            </div>
            <div class="change-card-body">
              <ul>
                <li v-for="(detail, j) in change.details" :key="j">
                  {{ detail }}
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div class="changelog-cta">
      <h2>最新のThreatGuardを体験</h2>
      <p>ブランドなりすまし検知・テイクダウン支援で、貴社のブランドを守ります</p>
      <a href="/threat-guard/guide/quickstart" class="cta-button">
        はじめる →
      </a>
      <a href="/threat-guard/features/" class="cta-button-outline">
        機能を見る
      </a>
    </div>
  </div>
</template>
