<script setup lang="ts">
import { useScrollAnimation } from './composables/useScrollAnimation'

useScrollAnimation()

interface Plan {
  name: string
  tagline: string
  priceAnnual: string
  monthlyEquiv: string
  priceMonthly: string
  takedowns: string
  domains: string
  recommended: boolean
}

const plans: Plan[] = [
  {
    name: 'Starter',
    tagline: '人を1人雇うより安い。最低限のフィッシング対策を自分で回せる',
    priceAnnual: '500万円/年',
    monthlyEquiv: '42万円/月',
    priceMonthly: '50万円/月',
    takedowns: '10件/月',
    domains: '1ドメイン',
    recommended: false,
  },
  {
    name: 'Professional',
    tagline: '金融庁に聞かれた時に、ボタン一つで報告書が出せる',
    priceAnnual: '1,000万円/年',
    monthlyEquiv: '84万円/月',
    priceMonthly: '100万円/月',
    takedowns: '30件/月',
    domains: '3ドメイン',
    recommended: true,
  },
  {
    name: 'Enterprise',
    tagline: 'Web・メール・アプリ・ダークウェブ。フィッシング対策を丸投げ',
    priceAnnual: '2,000万円/年',
    monthlyEquiv: '167万円/月',
    priceMonthly: '200万円/月',
    takedowns: '100件/月',
    domains: '10ドメイン',
    recommended: false,
  },
  {
    name: 'Enterprise+',
    tagline: '包括的なブランド保護サービス',
    priceAnnual: '個別見積',
    monthlyEquiv: '',
    priceMonthly: '',
    takedowns: '無制限',
    domains: '無制限',
    recommended: false,
  },
]

interface FeatureRow {
  name: string
  tiers: [boolean, boolean, boolean, boolean]
}

interface FeatureCategory {
  title: string
  features: FeatureRow[]
}

const featureCategories: FeatureCategory[] = [
  {
    title: '監視チャネル',
    features: [
      { name: '類似ドメイン監視', tiers: [true, true, true, true] },
      { name: 'CT証明書監視', tiers: [true, true, true, true] },
      { name: 'Webプローブ', tiers: [true, true, true, true] },
      { name: 'メールフィッシング検知', tiers: [false, true, true, true] },
      { name: 'SNS監視', tiers: [false, true, true, true] },
      { name: 'ダークウェブ監視', tiers: [false, false, true, true] },
      { name: '偽アプリ検知', tiers: [false, false, true, true] },
    ],
  },
  {
    title: '分析・対応',
    features: [
      { name: 'AIリスク判定', tiers: [true, true, true, true] },
      { name: 'テイクダウン申請', tiers: [true, true, true, true] },
      { name: 'ブラウザ報告', tiers: [true, true, true, true] },
    ],
  },
  {
    title: 'レポート',
    features: [
      { name: '月次PDFレポート', tiers: [true, true, true, true] },
      { name: '金融庁Excelレポート', tiers: [false, true, true, true] },
      { name: 'カスタムレポート', tiers: [false, false, true, true] },
    ],
  },
  {
    title: '運用・連携',
    features: [
      { name: 'メール通知', tiers: [true, true, true, true] },
      { name: 'Slack/Teams通知', tiers: [false, true, true, true] },
      { name: 'SSO', tiers: [false, true, true, true] },
      { name: 'API連携', tiers: [false, false, true, true] },
      { name: '専任カスタマーサクセス', tiers: [false, false, true, true] },
    ],
  },
]

const tierNames = ['Starter', 'Pro', 'Enterprise', 'Enterprise+']
</script>

<template>
  <div class="pricing-page">
    <!-- Hero -->
    <section class="pricing-hero">
      <h1 class="pricing-title">料金プラン</h1>
      <p class="pricing-subtitle">企業規模・ニーズに合わせた4つのプランをご用意</p>
    </section>

    <!-- Plan Cards -->
    <section class="pricing-cards animate-stagger">
      <div
        v-for="plan in plans"
        :key="plan.name"
        :class="['pricing-card', 'animate-on-scroll', { recommended: plan.recommended }]"
      >
        <span v-if="plan.recommended" class="cb-badge cb-badge-blue recommended-badge">おすすめ</span>
        <h3 class="plan-name">{{ plan.name }}</h3>
        <p class="plan-tagline">{{ plan.tagline }}</p>
        <div class="plan-price">{{ plan.priceAnnual }}</div>
        <div v-if="plan.monthlyEquiv" class="plan-monthly">月換算 {{ plan.monthlyEquiv }}</div>
        <div class="plan-details">
          <div class="plan-detail">
            <span class="detail-label">テイクダウン</span>
            <span class="detail-value">{{ plan.takedowns }}</span>
          </div>
          <div class="plan-detail">
            <span class="detail-label">ドメイン</span>
            <span class="detail-value">{{ plan.domains }}</span>
          </div>
        </div>
        <a
          href="https://app.threatguard.jp/contact"
          :class="plan.recommended ? 'cb-cta' : 'cb-cta-outline'"
          style="width: 100%; justify-content: center; margin-top: 16px;"
        >
          {{ plan.name === 'Enterprise+' ? 'お問い合わせ' : 'プランを選択' }}
        </a>
      </div>
    </section>

    <!-- Tip -->
    <div class="pricing-tip animate-on-scroll">
      <span class="tip-icon">💡</span>
      <strong>年一括前払い</strong>をお選びいただくと、<strong>2ヶ月分無料</strong>となりお得です。
    </div>

    <!-- Feature Comparison -->
    <section class="pricing-comparison">
      <h2 class="section-heading animate-on-scroll">機能比較</h2>

      <div
        v-for="category in featureCategories"
        :key="category.title"
        class="comparison-category animate-on-scroll"
      >
        <h3 class="category-title">{{ category.title }}</h3>
        <div class="comparison-table">
          <div class="comparison-header">
            <div class="comparison-feature">機能</div>
            <div v-for="tier in tierNames" :key="tier" class="comparison-tier">{{ tier }}</div>
          </div>
          <div
            v-for="feature in category.features"
            :key="feature.name"
            class="comparison-row"
          >
            <div class="comparison-feature">{{ feature.name }}</div>
            <div
              v-for="(available, i) in feature.tiers"
              :key="i"
              class="comparison-tier"
            >
              <span v-if="available" class="check-icon">✓</span>
              <span v-else class="dash-icon">—</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Domain & Overage -->
    <section class="pricing-extras animate-on-scroll">
      <div class="extras-grid">
        <div class="extras-card">
          <h3>ドメイン数</h3>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Starter</th>
                <th>Pro</th>
                <th>Enterprise</th>
                <th>Enterprise+</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>プライマリ</td>
                <td>1</td>
                <td>3</td>
                <td>10</td>
                <td>無制限</td>
              </tr>
              <tr>
                <td>保有ドメイン</td>
                <td>10</td>
                <td>50</td>
                <td>無制限</td>
                <td>無制限</td>
              </tr>
              <tr>
                <td>追加料金</td>
                <td>+5万/月</td>
                <td>+5万/月</td>
                <td>+3万/月</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="extras-card">
          <h3>テイクダウン超過</h3>
          <div class="overage-items">
            <div class="overage-item">
              <span class="overage-label">年契約</span>
              <span class="overage-price">4万円/件</span>
            </div>
            <div class="overage-item">
              <span class="overage-label">月契約</span>
              <span class="overage-price">5万円/件</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="pricing-cta animate-on-scroll">
      <h2>プランの詳細やお見積りについて</h2>
      <p>お気軽にお問い合わせください</p>
      <div class="cta-actions">
        <a href="https://app.threatguard.jp/contact" class="cb-cta">お問い合わせ →</a>
        <a href="/threat-guard/pricing/faq" class="cb-cta-outline">FAQ</a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.pricing-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 24px 96px;
}

/* Hero */
.pricing-hero {
  text-align: center;
  padding: 80px 0 48px;
}

.pricing-title {
  font-size: 56px;
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: var(--cb-near-black);
  margin: 0 0 16px;
}

.dark .pricing-title {
  color: var(--cb-white);
}

.pricing-subtitle {
  font-size: 18px;
  color: #5b616e;
  margin: 0;
}

.dark .pricing-subtitle {
  color: rgba(238, 240, 243, 0.7);
}

/* Plan Cards */
.pricing-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 32px;
}

.pricing-card {
  position: relative;
  border: 1px solid var(--cb-muted-border);
  border-radius: 16px;
  padding: 32px 24px;
  background: var(--cb-white);
  text-align: center;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.dark .pricing-card {
  background: var(--cb-dark-card);
  border-color: rgba(255, 255, 255, 0.08);
}

.pricing-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 24px rgba(0, 82, 255, 0.06);
}

.pricing-card.recommended {
  border: 2px solid var(--cb-blue);
  box-shadow: 0 0 0 4px rgba(0, 82, 255, 0.08);
}

.recommended-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
}

.plan-name {
  font-size: 20px;
  font-weight: 600;
  color: var(--cb-near-black);
  margin: 8px 0 8px;
}

.dark .plan-name {
  color: var(--cb-white);
}

.plan-tagline {
  font-size: 13px;
  line-height: 1.5;
  color: #5b616e;
  margin: 0 0 20px;
  min-height: 40px;
}

.dark .plan-tagline {
  color: rgba(238, 240, 243, 0.5);
}

.plan-price {
  font-size: 28px;
  font-weight: 400;
  color: var(--cb-near-black);
  margin-bottom: 4px;
}

.dark .plan-price {
  color: var(--cb-white);
}

.plan-monthly {
  font-size: 13px;
  color: #5b616e;
  margin-bottom: 20px;
}

.dark .plan-monthly {
  color: rgba(238, 240, 243, 0.5);
}

.plan-details {
  border-top: 1px solid var(--cb-muted-border);
  padding-top: 16px;
  margin-bottom: 8px;
}

.dark .plan-details {
  border-color: rgba(255, 255, 255, 0.08);
}

.plan-detail {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin-bottom: 8px;
}

.detail-label {
  color: #5b616e;
}

.dark .detail-label {
  color: rgba(238, 240, 243, 0.5);
}

.detail-value {
  font-weight: 600;
  color: var(--cb-near-black);
}

.dark .detail-value {
  color: var(--cb-white);
}

/* Tip */
.pricing-tip {
  border: 1px solid rgba(0, 82, 255, 0.2);
  border-radius: 16px;
  padding: 20px 24px;
  background: rgba(0, 82, 255, 0.04);
  margin-bottom: 64px;
  font-size: 15px;
  color: var(--cb-near-black);
}

.dark .pricing-tip {
  background: rgba(0, 82, 255, 0.08);
  border-color: rgba(0, 82, 255, 0.3);
  color: var(--cb-cool-gray);
}

.tip-icon {
  margin-right: 8px;
}

/* Feature Comparison */
.pricing-comparison {
  margin-bottom: 64px;
}

.section-heading {
  font-size: 36px;
  font-weight: 400;
  line-height: 1.11;
  text-align: center;
  color: var(--cb-near-black);
  margin-bottom: 40px;
}

.dark .section-heading {
  color: var(--cb-white);
}

.comparison-category {
  margin-bottom: 32px;
}

.category-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--cb-near-black);
  margin: 0 0 12px;
}

.dark .category-title {
  color: var(--cb-white);
}

.comparison-table {
  border: 1px solid var(--cb-muted-border);
  border-radius: 12px;
  overflow: hidden;
}

.dark .comparison-table {
  border-color: rgba(255, 255, 255, 0.08);
}

.comparison-header {
  display: grid;
  grid-template-columns: 1.5fr repeat(4, 1fr);
  background: var(--cb-cool-gray);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.dark .comparison-header {
  background: var(--cb-dark-card);
}

.comparison-header > div {
  padding: 12px 16px;
  text-align: center;
}

.comparison-header .comparison-feature {
  text-align: left;
}

.comparison-row {
  display: grid;
  grid-template-columns: 1.5fr repeat(4, 1fr);
  border-top: 1px solid var(--cb-muted-border);
}

.dark .comparison-row {
  border-color: rgba(255, 255, 255, 0.06);
}

.comparison-row > div {
  padding: 12px 16px;
  font-size: 14px;
  text-align: center;
}

.comparison-row .comparison-feature {
  text-align: left;
  color: var(--cb-near-black);
}

.dark .comparison-row .comparison-feature {
  color: var(--cb-cool-gray);
}

.check-icon {
  color: #059669;
  font-weight: 700;
}

.dark .check-icon {
  color: #34d399;
}

.dash-icon {
  color: var(--cb-muted-border);
}

/* Extras */
.pricing-extras {
  margin-bottom: 64px;
}

.extras-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}

.extras-card {
  border: 1px solid var(--cb-muted-border);
  border-radius: 16px;
  padding: 24px;
  background: var(--cb-white);
}

.dark .extras-card {
  background: var(--cb-dark-card);
  border-color: rgba(255, 255, 255, 0.08);
}

.extras-card h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px;
}

.extras-card table {
  width: 100%;
  font-size: 13px;
}

.extras-card th,
.extras-card td {
  padding: 8px;
  text-align: center;
}

.extras-card th {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-weight: 700;
}

.overage-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.overage-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--cb-muted-border);
}

.dark .overage-item {
  border-color: rgba(255, 255, 255, 0.06);
}

.overage-label {
  font-size: 14px;
  color: #5b616e;
}

.dark .overage-label {
  color: rgba(238, 240, 243, 0.5);
}

.overage-price {
  font-size: 16px;
  font-weight: 600;
  color: var(--cb-near-black);
}

.dark .overage-price {
  color: var(--cb-white);
}

/* CTA */
.pricing-cta {
  text-align: center;
  padding: 64px 0 0;
}

.pricing-cta h2 {
  font-size: 36px;
  font-weight: 400;
  line-height: 1.11;
  color: var(--cb-near-black);
  margin: 0 0 12px;
}

.dark .pricing-cta h2 {
  color: var(--cb-white);
}

.pricing-cta p {
  font-size: 18px;
  color: #5b616e;
  margin: 0 0 32px;
}

.dark .pricing-cta p {
  color: rgba(238, 240, 243, 0.7);
}

.cta-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

/* Responsive */
@media (max-width: 768px) {
  .pricing-title {
    font-size: 36px;
  }

  .pricing-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .comparison-header,
  .comparison-row {
    grid-template-columns: 1.5fr repeat(4, 1fr);
    font-size: 11px;
  }

  .comparison-row > div,
  .comparison-header > div {
    padding: 8px 6px;
  }

  .extras-grid {
    grid-template-columns: 1fr;
  }

  .section-heading,
  .pricing-cta h2 {
    font-size: 28px;
  }
}

@media (max-width: 576px) {
  .pricing-hero {
    padding: 48px 0 32px;
  }

  .pricing-title {
    font-size: 28px;
  }

  .pricing-cards {
    grid-template-columns: 1fr;
  }
}
</style>
