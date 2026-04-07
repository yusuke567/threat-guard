import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import ChangelogPage from './ChangelogPage.vue'
import './changelog.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ChangelogPage', ChangelogPage)
  }
} satisfies Theme
