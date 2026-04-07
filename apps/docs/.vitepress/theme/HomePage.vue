<script setup lang="ts">
import { useScrollAnimation } from './composables/useScrollAnimation'

useScrollAnimation()

const features = [
  {
    icon: '🔍',
    title: '自動脅威検知',
    description: '類似ドメイン、フィッシングサイト、SNS上の不正投稿を24時間自動監視。CT証明書・Webプローブ・ダークウェブまで網羅。',
    link: '/threat-guard/features/threat-detection',
    badge: '6つの検知手法',
  },
  {
    icon: '🤖',
    title: 'AIリスク判定',
    description: 'Claude AIが脅威の危険度を5段階で自動分類。0-100のリスクスコアで対応の優先順位が一目でわかる。',
    link: '/threat-guard/features/ai-risk-scoring',
    badge: '精度92%',
  },
  {
    icon: '📝',
    title: 'ワンクリックテイクダウン',
    description: '削除申請メールを自動生成。WHOIS自動取得・一括申請・Google Safe Browsing報告まで一気通貫。',
    link: '/threat-guard/features/takedown',
    badge: '自動化',
  },
  {
    icon: '📊',
    title: 'コンプライアンスレポート',
    description: '月次PDF・金融庁Excel・カスタムレポートを自動生成。監査対応の工数を大幅に削減。',
    link: '/threat-guard/features/reports',
    badge: '金融庁対応',
  },
]

const steps = [
  { number: '01', title: '検知', description: '24時間自動で脅威を検知' },
  { number: '02', title: '分析', description: 'AIがリスクを自動評価' },
  { number: '03', title: '対応', description: 'ワンクリックで削除申請' },
  { number: '04', title: '報告', description: 'レポートを自動生成' },
]

const problems = [
  { label: '人手での監視', detail: '24時間体制は現実的でない' },
  { label: '検知の遅れ', detail: '発見時には被害が拡大済み' },
  { label: '対応の手間', detail: '削除申請の手続きが煩雑' },
]
</script>

<template>
  <div class="home-page">
    <!-- Hero -->
    <section class="home-hero">
      <div class="hero-badge">
        <span class="cb-badge cb-badge-blue">ブランド保護SaaS</span>
      </div>
      <h1 class="hero-title">
        ブランドなりすまし検知・<br>テイクダウン支援
      </h1>
      <p class="hero-subtitle">
        フィッシング詐欺から顧客とブランドを守る。<br>
        検知から対応まで、すべてを自動化。
      </p>
      <div class="hero-actions">
        <a href="/threat-guard/guide/what-is-threatguard" class="cb-cta">
          はじめる →
        </a>
        <a href="/threat-guard/pricing/" class="cb-cta-outline">
          料金プラン
        </a>
      </div>
    </section>

    <!-- Stats -->
    <section class="cb-stats animate-on-scroll">
      <div>
        <div class="cb-stat-number">6</div>
        <div class="cb-stat-label">検知手法</div>
      </div>
      <div>
        <div class="cb-stat-number">4</div>
        <div class="cb-stat-label">対応プラン</div>
      </div>
      <div>
        <div class="cb-stat-number">92%</div>
        <div class="cb-stat-label">検知精度</div>
      </div>
    </section>

    <!-- Features -->
    <section class="home-features">
      <h2 class="section-heading">主要機能</h2>
      <div class="feature-grid animate-stagger">
        <a
          v-for="feature in features"
          :key="feature.title"
          :href="feature.link"
          class="feature-card animate-on-scroll"
        >
          <div class="feature-icon">{{ feature.icon }}</div>
          <div class="feature-badge">
            <span class="cb-badge cb-badge-blue">{{ feature.badge }}</span>
          </div>
          <h3 class="feature-title">{{ feature.title }}</h3>
          <p class="feature-description">{{ feature.description }}</p>
          <span class="feature-link">詳しく見る →</span>
        </a>
      </div>
    </section>

    <!-- Dark Section: Why ThreatGuard -->
    <section class="home-dark-section animate-on-scroll">
      <h2 class="dark-section-title">ThreatGuardが選ばれる理由</h2>
      <p class="dark-section-subtitle">従来のフィッシング対策の限界を解決</p>

      <div class="problems-grid">
        <div v-for="problem in problems" :key="problem.label" class="problem-card">
          <div class="problem-icon">✕</div>
          <div class="problem-label">{{ problem.label }}</div>
          <div class="problem-detail">{{ problem.detail }}</div>
        </div>
      </div>

      <div class="solution-divider">
        <span class="solution-arrow">↓</span>
      </div>

      <div class="solution-block">
        <div class="solution-icon">✦</div>
        <h3 class="solution-title">ThreatGuardなら、すべて自動化</h3>
        <p class="solution-detail">
          脅威の検知から対応まで一気通貫で自動化。専門知識がなくても、フィッシング対策を効率的に運用できます。
        </p>
      </div>
    </section>

    <!-- Process Flow -->
    <section class="home-process">
      <h2 class="section-heading">ワークフロー</h2>
      <div class="process-grid animate-stagger">
        <div v-for="step in steps" :key="step.number" class="process-step animate-on-scroll">
          <div class="step-number">{{ step.number }}</div>
          <h3 class="step-title">{{ step.title }}</h3>
          <p class="step-description">{{ step.description }}</p>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="home-cta animate-on-scroll">
      <h2 class="cta-title">まずは無料診断から</h2>
      <p class="cta-subtitle">14日間、1ドメインの脅威検知を無料でお試しいただけます</p>
      <div class="cta-actions">
        <a href="/threat-guard/features/free-diagnosis" class="cb-cta">
          無料診断を始める →
        </a>
        <a href="/threat-guard/guide/quickstart" class="cb-cta-outline">
          クイックスタート
        </a>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 24px 96px;
}

/* Hero */
.home-hero {
  text-align: center;
  padding: 80px 0 64px;
}

.hero-badge {
  margin-bottom: 24px;
}

.hero-title {
  font-size: 56px;
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: -0.02em;
  color: var(--cb-near-black);
  margin: 0 0 20px;
}

.dark .hero-title {
  color: var(--cb-white);
}

.hero-subtitle {
  font-size: 18px;
  font-weight: 400;
  line-height: 1.6;
  color: #5b616e;
  margin: 0 0 40px;
}

.dark .hero-subtitle {
  color: rgba(238, 240, 243, 0.7);
}

.hero-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

/* Features */
.home-features {
  margin: 80px 0;
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

.feature-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.feature-card {
  border: 1px solid var(--cb-muted-border);
  border-radius: 16px;
  padding: 32px;
  background: var(--cb-white);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  text-decoration: none !important;
  display: block;
}

.dark .feature-card {
  background: var(--cb-dark-card);
  border-color: rgba(255, 255, 255, 0.08);
}

.feature-card:hover {
  border-color: var(--cb-hover-blue);
  box-shadow: 0 4px 24px rgba(0, 82, 255, 0.06);
}

.dark .feature-card:hover {
  box-shadow: 0 4px 24px rgba(0, 82, 255, 0.12);
}

.feature-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.feature-badge {
  margin-bottom: 12px;
}

.feature-title {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--cb-near-black);
  margin: 0 0 8px;
}

.dark .feature-title {
  color: var(--cb-white);
}

.feature-description {
  font-size: 15px;
  line-height: 1.6;
  color: #5b616e;
  margin: 0 0 16px;
}

.dark .feature-description {
  color: rgba(238, 240, 243, 0.7);
}

.feature-link {
  font-size: 14px;
  font-weight: 600;
  color: var(--cb-blue);
}

/* Dark Section */
.home-dark-section {
  background: var(--cb-near-black);
  color: var(--cb-white);
  margin: 0 -24px;
  padding: 80px 48px;
  border-radius: 32px;
  text-align: center;
}

.dark-section-title {
  font-size: 36px;
  font-weight: 400;
  line-height: 1.11;
  color: var(--cb-white);
  margin: 0 0 12px;
}

.dark-section-subtitle {
  font-size: 18px;
  color: rgba(238, 240, 243, 0.6);
  margin: 0 0 48px;
}

.problems-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 40px;
}

.problem-card {
  background: var(--cb-dark-card);
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.problem-icon {
  font-size: 20px;
  color: #f87171;
  margin-bottom: 12px;
}

.problem-label {
  font-size: 16px;
  font-weight: 600;
  color: var(--cb-white);
  margin-bottom: 4px;
}

.problem-detail {
  font-size: 14px;
  color: rgba(238, 240, 243, 0.5);
}

.solution-divider {
  margin: 32px 0;
}

.solution-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--cb-blue);
  color: white;
  font-size: 20px;
}

.solution-block {
  max-width: 600px;
  margin: 0 auto;
}

.solution-icon {
  font-size: 24px;
  color: var(--cb-hover-blue);
  margin-bottom: 12px;
}

.solution-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--cb-white);
  margin: 0 0 12px;
}

.solution-detail {
  font-size: 16px;
  line-height: 1.6;
  color: rgba(238, 240, 243, 0.7);
  margin: 0;
}

/* Process Flow */
.home-process {
  margin: 80px 0;
}

.process-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.process-step {
  text-align: center;
  padding: 32px 16px;
  border: 1px solid var(--cb-muted-border);
  border-radius: 16px;
  background: var(--cb-white);
}

.dark .process-step {
  background: var(--cb-dark-card);
  border-color: rgba(255, 255, 255, 0.08);
}

.step-number {
  font-size: 40px;
  font-weight: 400;
  line-height: 1.0;
  color: var(--cb-blue);
  margin-bottom: 12px;
}

.step-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--cb-near-black);
  margin: 0 0 8px;
}

.dark .step-title {
  color: var(--cb-white);
}

.step-description {
  font-size: 14px;
  color: #5b616e;
  margin: 0;
}

.dark .step-description {
  color: rgba(238, 240, 243, 0.6);
}

/* CTA */
.home-cta {
  text-align: center;
  padding: 80px 0 0;
}

.cta-title {
  font-size: 36px;
  font-weight: 400;
  line-height: 1.11;
  color: var(--cb-near-black);
  margin: 0 0 12px;
}

.dark .cta-title {
  color: var(--cb-white);
}

.cta-subtitle {
  font-size: 18px;
  color: #5b616e;
  margin: 0 0 32px;
}

.dark .cta-subtitle {
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
  .hero-title {
    font-size: 36px;
  }

  .feature-grid {
    grid-template-columns: 1fr;
  }

  .problems-grid {
    grid-template-columns: 1fr;
  }

  .process-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .section-heading,
  .dark-section-title,
  .cta-title {
    font-size: 28px;
  }

  .home-dark-section {
    margin: 0 -16px;
    padding: 48px 24px;
    border-radius: 24px;
  }
}

@media (max-width: 576px) {
  .home-hero {
    padding: 48px 0 40px;
  }

  .hero-title {
    font-size: 28px;
  }

  .process-grid {
    grid-template-columns: 1fr;
  }
}
</style>
