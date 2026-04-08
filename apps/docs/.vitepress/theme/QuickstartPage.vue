<script setup lang="ts">
import { useScrollAnimation } from './composables/useScrollAnimation'

useScrollAnimation()

interface Step {
  number: number
  icon: string
  title: string
  description: string
  details: string[]
}

const steps: Step[] = [
  {
    number: 1,
    icon: '🔑',
    title: 'アカウント作成',
    description: 'ThreatGuardにアクセスしてアカウントを作成',
    details: [
      'app.threatguard.jp にアクセス',
      'メールアドレスとパスワードで登録',
      '確認メールのリンクをクリックしてアカウントを有効化',
    ],
  },
  {
    number: 2,
    icon: '🏢',
    title: '組織情報の設定',
    description: '組織情報と通知設定を行います',
    details: [
      '組織名・業種・従業員規模を入力',
      'Slack通知を利用する場合、Webhook URLを設定',
      'メール通知の受信設定を確認',
    ],
  },
  {
    number: 3,
    icon: '✓',
    title: '保護対象ブランドの登録',
    description: 'フィッシング攻撃から守りたいブランドを登録',
    details: [
      'ブランド名を入力',
      'プライマリドメイン（例: example.co.jp）を設定',
      '関連キーワードを登録（社名、サービス名など）',
      'ブランドロゴをアップロード（画像類似度検知に使用）',
    ],
  },
  {
    number: 4,
    icon: '🌐',
    title: '保有ドメインの登録',
    description: '自社が保有するドメインをホワイトリストに登録',
    details: [
      '保有ドメインを一覧で登録',
      '誤検知防止のためのホワイトリスト機能',
      'ドメイン有効期限の監視も自動で開始',
    ],
  },
  {
    number: 5,
    icon: '📡',
    title: '監視開始',
    description: '登録完了後、自動的に監視が始まります',
    details: [
      '6時間ごとにスキャンを自動実行',
      '脅威検知時にSlack・メールで即座に通知',
      'ダッシュボードでリアルタイムに状況確認',
    ],
  },
  {
    number: 6,
    icon: '⚡',
    title: '脅威への対応',
    description: '検知された脅威にワンクリックで対応',
    details: [
      'ダッシュボードで検知された脅威を確認',
      'AIリスクスコアで対応優先順位を判断',
      'ワンクリックでテイクダウン申請を作成',
      '対応状況をリアルタイムで追跡',
    ],
  },
]
</script>

<template>
  <div class="quickstart-page">
    <!-- Hero -->
    <section class="quickstart-hero">
      <span class="cb-badge cb-badge-blue">6ステップで完了</span>
      <h1 class="quickstart-title">クイックスタート</h1>
      <p class="quickstart-subtitle">
        アカウント作成から監視開始まで、かんたん6ステップ
      </p>
    </section>

    <!-- Stepper -->
    <section class="quickstart-stepper">
      <div
        v-for="step in steps"
        :key="step.number"
        class="quickstart-step animate-on-scroll"
      >
        <div class="step-circle">{{ step.number }}</div>
        <div class="step-card">
          <div class="step-icon">{{ step.icon }}</div>
          <h3 class="step-title">{{ step.title }}</h3>
          <p class="step-description">{{ step.description }}</p>
          <ul class="step-details">
            <li v-for="(detail, i) in step.details" :key="i">{{ detail }}</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Support -->
    <section class="quickstart-support animate-on-scroll">
      <h2 class="support-title">サポート</h2>
      <p class="support-text">ご不明な点がございましたら、お気軽にお問い合わせください</p>
      <div class="support-cards">
        <div class="support-card">
          <div class="support-icon">📧</div>
          <div class="support-label">メール</div>
          <div class="support-value">support@threatguard.jp</div>
        </div>
        <div class="support-card">
          <div class="support-icon">💬</div>
          <div class="support-label">Slack</div>
          <div class="support-value">専用チャンネルでサポート</div>
        </div>
      </div>
    </section>

    <!-- Next Steps -->
    <section class="quickstart-next animate-on-scroll">
      <h2 class="next-title">次のステップ</h2>
      <div class="next-links">
        <a href="/threat-guard/features/" class="next-link">
          <span class="next-link-icon">📋</span>
          <span class="next-link-text">機能一覧を見る</span>
          <span class="next-link-arrow">→</span>
        </a>
        <a href="/threat-guard/features/takedown" class="next-link">
          <span class="next-link-icon">📝</span>
          <span class="next-link-text">テイクダウン申請について</span>
          <span class="next-link-arrow">→</span>
        </a>
        <a href="/threat-guard/technical/" class="next-link">
          <span class="next-link-icon">⚙️</span>
          <span class="next-link-text">技術詳細を見る</span>
          <span class="next-link-arrow">→</span>
        </a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.quickstart-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 24px 96px;
}

/* Hero */
.quickstart-hero {
  text-align: center;
  padding: 80px 0 64px;
}

.quickstart-title {
  font-size: 56px;
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: var(--cb-near-black);
  margin: 16px 0 16px;
}

.dark .quickstart-title {
  color: var(--cb-white);
}

.quickstart-subtitle {
  font-size: 18px;
  color: #5b616e;
  margin: 0;
}

.dark .quickstart-subtitle {
  color: rgba(238, 240, 243, 0.7);
}

/* Stepper */
.quickstart-stepper {
  position: relative;
  margin-bottom: 80px;
}

.quickstart-stepper::before {
  content: '';
  position: absolute;
  left: 20px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--cb-muted-border);
}

.dark .quickstart-stepper::before {
  background: rgba(255, 255, 255, 0.1);
}

.quickstart-step {
  position: relative;
  padding-left: 64px;
  margin-bottom: 32px;
}

.quickstart-step:last-child {
  margin-bottom: 0;
}

.step-circle {
  position: absolute;
  left: 8px;
  top: 24px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--cb-blue);
  color: white;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.step-card {
  border: 1px solid var(--cb-muted-border);
  border-radius: 16px;
  padding: 28px 32px;
  background: var(--cb-white);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.dark .step-card {
  background: var(--cb-dark-card);
  border-color: rgba(255, 255, 255, 0.08);
}

.step-card:hover {
  border-color: var(--cb-hover-blue);
  box-shadow: 0 4px 24px rgba(0, 82, 255, 0.06);
}

.dark .step-card:hover {
  box-shadow: 0 4px 24px rgba(0, 82, 255, 0.12);
}

.step-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.step-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--cb-near-black);
  margin: 0 0 8px;
}

.dark .step-title {
  color: var(--cb-white);
}

.step-description {
  font-size: 15px;
  color: #5b616e;
  margin: 0 0 12px;
}

.dark .step-description {
  color: rgba(238, 240, 243, 0.7);
}

.step-details {
  list-style: none;
  padding: 0;
  margin: 0;
}

.step-details li {
  position: relative;
  padding-left: 20px;
  font-size: 14px;
  color: #5b616e;
  margin-bottom: 6px;
  line-height: 1.5;
}

.dark .step-details li {
  color: rgba(238, 240, 243, 0.6);
}

.step-details li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 9px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--cb-blue);
  opacity: 0.4;
}

/* Support */
.quickstart-support {
  margin-bottom: 64px;
}

.support-title {
  font-size: 28px;
  font-weight: 400;
  text-align: center;
  color: var(--cb-near-black);
  margin: 0 0 12px;
}

.dark .support-title {
  color: var(--cb-white);
}

.support-text {
  font-size: 16px;
  color: #5b616e;
  text-align: center;
  margin: 0 0 32px;
}

.dark .support-text {
  color: rgba(238, 240, 243, 0.7);
}

.support-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.support-card {
  border: 1px solid var(--cb-muted-border);
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  background: var(--cb-white);
}

.dark .support-card {
  background: var(--cb-dark-card);
  border-color: rgba(255, 255, 255, 0.08);
}

.support-icon {
  font-size: 28px;
  margin-bottom: 8px;
}

.support-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--cb-near-black);
  margin-bottom: 4px;
}

.dark .support-label {
  color: var(--cb-white);
}

.support-value {
  font-size: 13px;
  color: #5b616e;
}

.dark .support-value {
  color: rgba(238, 240, 243, 0.6);
}

/* Next Steps */
.next-title {
  font-size: 28px;
  font-weight: 400;
  text-align: center;
  color: var(--cb-near-black);
  margin: 0 0 24px;
}

.dark .next-title {
  color: var(--cb-white);
}

.next-links {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.next-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border: 1px solid var(--cb-muted-border);
  border-radius: 16px;
  text-decoration: none !important;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  background: var(--cb-white);
}

.dark .next-link {
  background: var(--cb-dark-card);
  border-color: rgba(255, 255, 255, 0.08);
}

.next-link:hover {
  border-color: var(--cb-hover-blue);
  box-shadow: 0 4px 24px rgba(0, 82, 255, 0.06);
}

.next-link-icon {
  font-size: 24px;
}

.next-link-text {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--cb-near-black);
}

.dark .next-link-text {
  color: var(--cb-white);
}

.next-link-arrow {
  color: var(--cb-blue);
  font-weight: 600;
}

/* Responsive */
@media (max-width: 768px) {
  .quickstart-title {
    font-size: 36px;
  }

  .support-cards {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 576px) {
  .quickstart-hero {
    padding: 48px 0 40px;
  }

  .quickstart-title {
    font-size: 28px;
  }

  .quickstart-step {
    padding-left: 48px;
  }

  .step-card {
    padding: 20px 24px;
  }
}
</style>
