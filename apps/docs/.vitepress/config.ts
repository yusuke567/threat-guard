import { defineConfig } from 'vitepress'

const SITE_URL = 'https://yusuke567.github.io/threat-guard'

export default defineConfig({
  lang: 'ja-JP',
  title: 'ThreatGuard',
  description: 'ブランドなりすまし検知・テイクダウン支援SaaS',

  base: '/threat-guard/',

  head: [
    ['meta', { name: 'theme-color', content: '#0052ff' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'ThreatGuard' }],
    ['meta', { property: 'og:image', content: `${SITE_URL}/og-image.svg` }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: `${SITE_URL}/og-image.svg` }],
  ],

  transformHead({ pageData }) {
    const head: Array<[string, Record<string, string>]> = []
    const title = pageData.frontmatter.title || pageData.title || 'ThreatGuard'
    const description = pageData.frontmatter.description || 'ブランドなりすまし検知・テイクダウン支援SaaS'
    const path = pageData.relativePath
      .replace(/index\.md$/, '')
      .replace(/\.md$/, '.html')
    const url = `${SITE_URL}/${path}`

    head.push(['meta', { property: 'og:title', content: title }])
    head.push(['meta', { property: 'og:description', content: description }])
    head.push(['meta', { property: 'og:url', content: url }])
    head.push(['link', { rel: 'canonical', href: url }])

    return head
  },

  themeConfig: {
    nav: [
      { text: 'ガイド', link: '/guide/what-is-threatguard' },
      { text: '機能', link: '/features/' },
      { text: '技術詳細', link: '/technical/' },
      { text: '料金', link: '/pricing/' },
      { text: 'Changelog', link: '/changelog' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'はじめに',
          items: [
            { text: 'ThreatGuardとは', link: '/guide/what-is-threatguard' },
            { text: 'クイックスタート', link: '/guide/quickstart' },
          ]
        }
      ],
      '/features/': [
        {
          text: '機能',
          items: [
            { text: '機能概要', link: '/features/' },
            { text: '脅威検知', link: '/features/threat-detection' },
            { text: 'AIリスク判定', link: '/features/ai-risk-scoring' },
            { text: 'テイクダウン申請', link: '/features/takedown' },
            { text: 'レポート', link: '/features/reports' },
            { text: '無料診断', link: '/features/free-diagnosis' },
          ]
        }
      ],
      '/technical/': [
        {
          text: '技術詳細',
          items: [
            { text: '技術概要', link: '/technical/' },
            { text: 'アーキテクチャ', link: '/technical/architecture' },
            { text: 'セキュリティ', link: '/technical/security' },
            { text: 'リスクスコアアルゴリズム', link: '/technical/risk-algorithm' },
            { text: 'API連携', link: '/technical/api' },
          ]
        }
      ],
      '/pricing/': [
        {
          text: '料金プラン',
          items: [
            { text: 'プラン比較', link: '/pricing/' },
            { text: 'FAQ', link: '/pricing/faq' },
          ]
        }
      ],
      '/legal/': [
        {
          text: '法的情報',
          items: [
            { text: '利用規約', link: '/legal/terms' },
            { text: 'プライバシーポリシー', link: '/legal/privacy' },
          ]
        }
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/yusuke567/threat-guard' }
    ],

    footer: {
      message: '<a href="/threat-guard/legal/terms">利用規約</a> | <a href="/threat-guard/legal/privacy">プライバシーポリシー</a>',
      copyright: 'Copyright © 2026 ThreatGuard'
    },

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: '検索', buttonAriaLabel: '検索' },
              modal: {
                noResultsText: '結果が見つかりません',
                resetButtonTitle: 'リセット',
                footer: {
                  selectText: '選択',
                  navigateText: '移動',
                  closeText: '閉じる'
                }
              }
            }
          }
        }
      }
    },

    outline: {
      label: '目次'
    },

    docFooter: {
      prev: '前のページ',
      next: '次のページ'
    },

    lastUpdated: {
      text: '最終更新'
    },

    returnToTopLabel: 'トップに戻る',
    sidebarMenuLabel: 'メニュー',
    darkModeSwitchLabel: 'ダークモード',
  }
})
