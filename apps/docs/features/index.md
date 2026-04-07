# 機能概要

ThreatGuardは、**検知 → 分析 → 対応 → 報告** の一連のフローを自動化します。

## ワークフロー

<div class="cb-card-grid" style="grid-template-columns: repeat(4, 1fr);">
  <div class="cb-card" style="text-align: center;">
    <div style="font-size: 32px; margin-bottom: 8px;">🔍</div>
    <div style="font-weight: 600; margin-bottom: 4px;">検知</div>
    <div style="font-size: 13px; color: #5b616e;">ドメイン・CT・SNS・Web</div>
  </div>
  <div class="cb-card" style="text-align: center;">
    <div style="font-size: 32px; margin-bottom: 8px;">🤖</div>
    <div style="font-weight: 600; margin-bottom: 4px;">分析</div>
    <div style="font-size: 13px; color: #5b616e;">AIリスク判定・スコア</div>
  </div>
  <div class="cb-card" style="text-align: center;">
    <div style="font-size: 32px; margin-bottom: 8px;">📝</div>
    <div style="font-weight: 600; margin-bottom: 4px;">対応</div>
    <div style="font-size: 13px; color: #5b616e;">テイクダウン・報告</div>
  </div>
  <div class="cb-card" style="text-align: center;">
    <div style="font-size: 32px; margin-bottom: 8px;">📊</div>
    <div style="font-weight: 600; margin-bottom: 4px;">報告</div>
    <div style="font-size: 13px; color: #5b616e;">PDF・Excel・カスタム</div>
  </div>
</div>

## 機能一覧

### 脅威検知

| 機能 | 説明 | 対応プラン |
|------|------|-----------|
| [類似ドメイン監視](/features/threat-detection#類似ドメイン監視) | ホモグリフ攻撃等の類似ドメインを検知 | 全プラン |
| [CT監視](/features/threat-detection#ct監視) | SSL証明書の発行を監視 | 全プラン |
| [Webプローブ](/features/threat-detection#webプローブ) | サイトのスクリーンショット・詳細情報を取得 | 全プラン |
| [SNS監視](/features/threat-detection#sns監視) | Twitter/X等での不正投稿を検知 | Professional以上 |
| ダークウェブ監視 | 漏洩情報、不正販売を監視 | Enterprise以上 |
| 偽アプリ検知 | iOS/Androidの偽アプリを検知 | Enterprise以上 |

### 分析・評価

| 機能 | 説明 | 対応プラン |
|------|------|-----------|
| [AIリスク判定](/features/ai-risk-scoring) | Claude AIによる脅威分類 | 全プラン |
| [リスクスコア](/features/ai-risk-scoring#リスクスコア) | 0-100の数値でリスクを評価 | 全プラン |
| コンテンツ分析 | ページ内容の詳細分析 | 全プラン |

### 対応・テイクダウン

| 機能 | 説明 | 対応プラン |
|------|------|-----------|
| [テイクダウン申請](/features/takedown) | 削除申請メールの自動生成 | 全プラン |
| 一括申請 | 複数ドメインをまとめて申請 | 全プラン |
| ブラウザ報告 | Google Safe Browsing等への報告 | 全プラン |
| 対応追跡 | テイクダウンの進捗管理 | 全プラン |

### レポート

| 機能 | 説明 | 対応プラン |
|------|------|-----------|
| [月次PDFレポート](/features/reports) | 検知・対応状況のサマリー | 全プラン |
| 金融庁Excelレポート | 規制当局対応フォーマット | Professional以上 |
| カスタムレポート | 要件に応じたレポート | Enterprise以上 |

### 通知・連携

| 機能 | 説明 | 対応プラン |
|------|------|-----------|
| メール通知 | 脅威検知時のアラート | 全プラン |
| Slack/Teams通知 | チャットツール連携 | Professional以上 |
| SSO | Okta, Azure AD等との連携 | Professional以上 |
| API連携 | 外部システムとのAPI連携 | Enterprise以上 |

## プラン別機能比較

詳細は[料金プラン](/pricing/)をご覧ください。

## 各機能の詳細

<div class="cb-card-grid">
  <a href="/threat-guard/features/threat-detection" class="cb-card" style="text-decoration: none; display: block;">
    <div style="font-size: 24px; margin-bottom: 8px;">🔍</div>
    <div style="font-weight: 600; color: var(--cb-near-black); margin-bottom: 4px;">脅威検知</div>
    <div style="font-size: 14px; color: #5b616e;">6つの手法で脅威を24時間監視</div>
  </a>
  <a href="/threat-guard/features/ai-risk-scoring" class="cb-card" style="text-decoration: none; display: block;">
    <div style="font-size: 24px; margin-bottom: 8px;">🤖</div>
    <div style="font-weight: 600; color: var(--cb-near-black); margin-bottom: 4px;">AIリスク判定</div>
    <div style="font-size: 14px; color: #5b616e;">Claude AIによる5段階自動分類</div>
  </a>
  <a href="/threat-guard/features/takedown" class="cb-card" style="text-decoration: none; display: block;">
    <div style="font-size: 24px; margin-bottom: 8px;">📝</div>
    <div style="font-weight: 600; color: var(--cb-near-black); margin-bottom: 4px;">テイクダウン申請</div>
    <div style="font-size: 14px; color: #5b616e;">削除申請の自動化・進捗管理</div>
  </a>
  <a href="/threat-guard/features/reports" class="cb-card" style="text-decoration: none; display: block;">
    <div style="font-size: 24px; margin-bottom: 8px;">📊</div>
    <div style="font-weight: 600; color: var(--cb-near-black); margin-bottom: 4px;">レポート</div>
    <div style="font-size: 14px; color: #5b616e;">PDF・Excel・カスタムレポート生成</div>
  </a>
  <a href="/threat-guard/features/free-diagnosis" class="cb-card" style="text-decoration: none; display: block;">
    <div style="font-size: 24px; margin-bottom: 8px;">🎯</div>
    <div style="font-weight: 600; color: var(--cb-near-black); margin-bottom: 4px;">無料診断</div>
    <div style="font-size: 14px; color: #5b616e;">14日間の無料脅威検知トライアル</div>
  </a>
</div>
