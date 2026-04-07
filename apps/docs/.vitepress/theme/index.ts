import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import ChangelogPage from './ChangelogPage.vue'
import HomePage from './HomePage.vue'
import PricingPage from './PricingPage.vue'
import QuickstartPage from './QuickstartPage.vue'
import './global.css'
import './animations.css'
import './changelog.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('ChangelogPage', ChangelogPage)
    app.component('HomePage', HomePage)
    app.component('PricingPage', PricingPage)
    app.component('QuickstartPage', QuickstartPage)
  }
} satisfies Theme
