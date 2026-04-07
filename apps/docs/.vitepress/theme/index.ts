import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import ChangelogPage from './ChangelogPage.vue'
import HomePage from './HomePage.vue'
import './global.css'
import './changelog.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ChangelogPage', ChangelogPage)
    app.component('HomePage', HomePage)
  }
} satisfies Theme
