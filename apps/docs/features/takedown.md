# テイクダウン申請

ThreatGuardは、フィッシングサイトの削除申請（テイクダウン）を効率化します。

## テイクダウンとは

フィッシングサイトや不正コンテンツの**削除を依頼**するプロセスです。

### 申請先

| 申請先 | 役割 | 対応速度 |
|--------|------|---------|
| ドメイン登録者 | ドメインの所有者 | 様々 |
| レジストラ | ドメイン管理会社 | 数日〜1週間 |
| ホスティング事業者 | サーバー提供者 | 数日 |
| ブラウザベンダー | Safe Browsing等 | 数時間〜1日 |

## ThreatGuardの機能

### 1. 申請メール自動生成

ボタン一つで、Abuse報告メールを自動生成します。

#### 生成内容

- 申請先に合わせた適切なフォーマット
- 証拠（スクリーンショット、URL）の添付
- **日本語/英語の自動選択**（登録者の所在地に応じて）

#### 生成例

```
件名: Phishing Report - examp1e-bank.com

Dear Abuse Team,

We are writing to report a phishing website that is impersonating
our company, Example Bank.

Domain: examp1e-bank.com
Issue: This site is designed to steal customer credentials by
       mimicking our official website (example-bank.co.jp).

Evidence:
- Screenshot: [attached]
- WHOIS lookup date: 2026-03-15

We request immediate suspension of this domain.

Best regards,
Example Bank Security Team
```

### 2. Abuse連絡先の自動取得

WHOISデータからAbuse連絡先を自動で抽出します。

- レジストラのAbuse窓口
- ホスティング事業者の連絡先
- 該当がない場合は一般的なabuse@メールを提案

### 3. 一括申請

複数のドメインをまとめてテイクダウン申請できます。

```
1. 対象ドメインを選択（チェックボックス）
2. 「一括テイクダウン」をクリック
3. 申請内容を確認
4. 一括送信
```

### 4. ブラウザ報告

Google Safe BrowsingやMicrosoft SmartScreenへ報告することで、ブラウザが警告を表示するようになります。

| 報告先 | 効果 |
|--------|------|
| Google Safe Browsing | Chrome, Firefox, Safari等で警告表示 |
| Microsoft SmartScreen | Edge, Windows Defenderで警告表示 |

### 5. 対応追跡

テイクダウンの進捗を一元管理します。

| ステータス | 説明 |
|-----------|------|
| 申請中 | テイクダウン申請を送信済み |
| 対応中 | 先方から返信あり、処理中 |
| 完了 | ドメイン停止・コンテンツ削除完了 |
| 却下 | 申請が却下された |

## テイクダウンの流れ

```
脅威を検知
    ↓
AIリスク判定（phishing判定）
    ↓
「テイクダウン申請」をクリック
    ↓
申請内容を確認・編集
    ↓
送信
    ↓
進捗を追跡
    ↓
完了確認
```

## 申請のコツ

### 効果的な申請のポイント

1. **証拠を明確に**: スクリーンショット、URLを必ず添付
2. **迅速に**: 検知後24時間以内の申請が効果的
3. **複数経路で**: レジストラとホスティング両方に申請
4. **ブラウザ報告を併用**: 削除までの被害を軽減

### 申請が却下された場合

- 証拠の追加提出
- 別の申請先への報告
- 法的措置の検討（Enterprise+プランでサポート）

## プラン別の制限

| プラン | テイクダウン申請/月 | 超過時 |
|--------|-------------------|--------|
| Starter | 10件 | 4万円/件（年契約）、5万円/件（月契約） |
| Professional | 30件 | 同上 |
| Enterprise | 100件 | 同上 |
| Enterprise+ | 無制限 | - |

## 次のステップ

- [レポート機能](/features/reports)
- [料金プラン](/pricing/)
