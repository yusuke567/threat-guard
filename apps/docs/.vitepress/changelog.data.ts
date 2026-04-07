import fs from 'node:fs'
import path from 'node:path'
import { defineLoader } from 'vitepress'

export interface ChangeItem {
  type: 'feature' | 'improvement' | 'fix' | 'breaking'
  title: string
  details: string[]
}

export interface ChangelogEntry {
  date: string
  title: string
  version: string
  changes: ChangeItem[]
}

declare const data: ChangelogEntry[]
export { data }

export default defineLoader({
  watch: ['../changelog-entries.json'],
  load() {
    const filePath = path.resolve(__dirname, '../changelog-entries.json')
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content) as ChangelogEntry[]
  },
})
