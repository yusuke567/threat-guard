<script setup lang="ts">
import { ref, computed } from 'vue'
import { data as entries } from '../changelog.data'
import type { ChangeItem, ChangelogEntry } from '../changelog.data'
import { useScrollAnimation } from './composables/useScrollAnimation'

useScrollAnimation()

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

const filteredEntries = computed(() => {
  if (activeFilter.value === 'all') return entries
  return entries
    .map((entry) => ({
      ...entry,
      changes: entry.changes.filter((c) => c.type === activeFilter.value),
    }))
    .filter((entry) => entry.changes.length > 0)
})

const stats = computed(() => ({
  pages: 23,
  updates: entries.length,
  features: entries.reduce(
    (sum: number, e: ChangelogEntry) => sum + e.changes.filter((c: ChangeItem) => c.type === 'feature').length,
    0
  ),
}))
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
    <div class="changelog-stats animate-on-scroll">
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
        class="changelog-entry animate-on-scroll"
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
