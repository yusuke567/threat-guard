'use client';

import { useEffect, useState } from 'react';
import { PageHeader, Button, Card } from '@/components/ui';
import { JpcertAlertCard } from '@/components/JpcertAlertCard';
import { getAlerts, getAlertSettings, updateAlertSettings, sendTestEmail, getSlackSettings, updateSlackSettings, sendSlackTestNotification } from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
  new_threat: '新規脅威',
  site_change: 'サイト変更',
  scan_summary: 'スキャンサマリー',
};

export default function AlertsPage() {
  // Settings state
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState(60);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);

  // Slack settings state
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [slackWebhookConfigured, setSlackWebhookConfigured] = useState(false);
  const [slackNotifyEnabled, setSlackNotifyEnabled] = useState(false);
  const [slackNotifyThreshold, setSlackNotifyThreshold] = useState(60);
  const [slackNotifyTypes, setSlackNotifyTypes] = useState('new_threat,site_change,scan_summary');
  const [slackLoading, setSlackLoading] = useState(true);
  const [slackSaving, setSlackSaving] = useState(false);
  const [slackSaveMessage, setSlackSaveMessage] = useState<string | null>(null);
  const [slackTesting, setSlackTesting] = useState(false);
  const [slackTestMessage, setSlackTestMessage] = useState<string | null>(null);

  // History state
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 20;

  useEffect(() => {
    getSlackSettings()
      .then((data) => {
        setSlackWebhookConfigured(data.slackWebhookConfigured ?? false);
        setSlackNotifyEnabled(data.slackNotifyEnabled ?? false);
        setSlackNotifyThreshold(data.slackNotifyThreshold ?? 60);
        setSlackNotifyTypes(data.slackNotifyTypes ?? 'new_threat,site_change,scan_summary');
      })
      .catch(console.error)
      .finally(() => setSlackLoading(false));
  }, []);

  useEffect(() => {
    getAlertSettings()
      .then((data) => {
        setAlertEnabled(data.alertEnabled ?? false);
        setAlertThreshold(data.alertThreshold ?? 60);
      })
      .catch(console.error)
      .finally(() => setSettingsLoading(false));
  }, []);

  useEffect(() => {
    setAlertsLoading(true);
    getAlerts(page, LIMIT)
      .then((data) => {
        setAlerts(data.alerts || []);
        setTotalPages(data.totalPages || 1);
      })
      .catch(console.error)
      .finally(() => setAlertsLoading(false));
  }, [page]);

  const handleTestEmail = async () => {
    setSendingTest(true);
    setTestMessage(null);
    try {
      const res = await sendTestEmail();
      setTestMessage(res.message || 'テストメールを送信しました');
      // Refresh alert history
      setPage(1);
      const data = await getAlerts(1, LIMIT);
      setAlerts(data.alerts || []);
      setTotalPages(data.totalPages || 1);
      setTimeout(() => setTestMessage(null), 5000);
    } catch (e: any) {
      console.error(e);
      setTestMessage(e?.message || 'テストメール送信に失敗しました');
    } finally {
      setSendingTest(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await updateAlertSettings({ alertEnabled, alertThreshold });
      setSaveMessage('設定を保存しました');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e) {
      console.error(e);
      setSaveMessage('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const SLACK_TYPE_OPTIONS = [
    { value: 'new_threat', label: '新規脅威検知' },
    { value: 'site_change', label: 'サイト変化検知' },
    { value: 'scan_summary', label: 'スキャンサマリー' },
  ];

  const toggleSlackType = (type: string) => {
    const types = slackNotifyTypes.split(',').map((t) => t.trim()).filter(Boolean);
    if (types.includes(type)) {
      setSlackNotifyTypes(types.filter((t) => t !== type).join(','));
    } else {
      setSlackNotifyTypes([...types, type].join(','));
    }
  };

  const handleSlackSave = async () => {
    setSlackSaving(true);
    setSlackSaveMessage(null);
    try {
      const data: any = {
        slackNotifyEnabled,
        slackNotifyThreshold,
        slackNotifyTypes,
      };
      // Only send webhook URL if user entered a new one
      if (slackWebhookUrl && slackWebhookUrl.startsWith('https://')) {
        data.slackWebhookUrl = slackWebhookUrl;
      }
      await updateSlackSettings(data);
      if (slackWebhookUrl && slackWebhookUrl.startsWith('https://')) {
        setSlackWebhookConfigured(true);
        setSlackWebhookUrl('');
      }
      setSlackSaveMessage('Slack設定を保存しました');
      setTimeout(() => setSlackSaveMessage(null), 3000);
    } catch (e: any) {
      console.error(e);
      setSlackSaveMessage(e?.message || '保存に失敗しました');
    } finally {
      setSlackSaving(false);
    }
  };

  const handleSlackTest = async () => {
    setSlackTesting(true);
    setSlackTestMessage(null);
    try {
      const res = await sendSlackTestNotification();
      setSlackTestMessage(res.message || 'テスト通知を送信しました');
      setTimeout(() => setSlackTestMessage(null), 5000);
    } catch (e: any) {
      console.error(e);
      setSlackTestMessage(e?.message || 'テスト送信に失敗しました');
    } finally {
      setSlackTesting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="🔔 通知設定" description="アラート通知の設定と送信履歴" />

      {/* JPCERT/CC連動アラート（Pro+限定） */}
      <JpcertAlertCard />

      {/* Section 1: Settings */}
      <Card className="space-y-6">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">通知設定</h2>

        {settingsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[var(--text-primary)]">メールアラート</p>
                <p className="text-sm text-[var(--text-secondary)]">脅威検知時にメールで通知を受け取る</p>
              </div>
              <button
                onClick={() => setAlertEnabled(!alertEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  alertEnabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-surface-card transition-transform ${
                    alertEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Threshold */}
            <div>
              <label className="block font-medium text-[var(--text-primary)] mb-1">リスクスコア閾値</label>
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                この値以上のリスクスコアを持つ脅威のみ通知されます
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(Number(e.target.value))}
                  className="flex-1 h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-lg font-bold text-blue-600 w-12 text-right">{alertThreshold}</span>
              </div>
              <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1 px-0.5">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            {/* Save & Test */}
            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </Button>
              <Button variant="secondary" onClick={handleTestEmail} disabled={sendingTest} title="テストメールを送信">
                {sendingTest ? '送信中...' : '📧 テストメール送信'}
              </Button>
              {saveMessage && (
                <span
                  className={`text-sm font-medium ${
                    saveMessage.includes('失敗') ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {saveMessage}
                </span>
              )}
              {testMessage && (
                <span
                  className={`text-sm font-medium ${
                    testMessage.includes('失敗') ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {testMessage}
                </span>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Section 2: Slack Notification Settings */}
      <Card className="space-y-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-[var(--text-primary)]">Slack通知設定</h2>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
            Slack
          </span>
        </div>

        {slackLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
          </div>
        ) : (
          <>
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[var(--text-primary)]">Slackアラート</p>
                <p className="text-sm text-[var(--text-secondary)]">脅威検知時にSlackチャンネルに通知を送信</p>
              </div>
              <button
                onClick={() => setSlackNotifyEnabled(!slackNotifyEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  slackNotifyEnabled ? 'bg-purple-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-surface-card transition-transform ${
                    slackNotifyEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Webhook URL */}
            <div>
              <label className="block font-medium text-[var(--text-primary)] mb-1">Webhook URL</label>
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                SlackのIncoming Webhook URLを設定してください
              </p>
              {slackWebhookConfigured && !slackWebhookUrl && (
                <p className="text-sm text-green-600 dark:text-green-400 mb-2">✅ Webhook URL設定済み</p>
              )}
              <input
                type="url"
                value={slackWebhookUrl}
                onChange={(e) => setSlackWebhookUrl(e.target.value)}
                placeholder={slackWebhookConfigured ? '新しいURLで上書き（変更しない場合は空欄）' : 'https://hooks.slack.com/services/...'}
                className="w-full px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm bg-white dark:bg-gray-900 text-[var(--text-primary)] placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Threshold */}
            <div>
              <label className="block font-medium text-[var(--text-primary)] mb-1">リスクスコア閾値</label>
              <p className="text-sm text-[var(--text-secondary)] mb-3">
                この値以上のリスクスコアを持つ脅威のみSlack通知されます
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={slackNotifyThreshold}
                  onChange={(e) => setSlackNotifyThreshold(Number(e.target.value))}
                  className="flex-1 h-2 bg-surface-elevated rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <span className="text-lg font-bold text-purple-600 w-12 text-right">{slackNotifyThreshold}</span>
              </div>
              <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1 px-0.5">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            {/* Notification types */}
            <div>
              <label className="block font-medium text-[var(--text-primary)] mb-2">通知タイプ</label>
              <div className="flex flex-wrap gap-2">
                {SLACK_TYPE_OPTIONS.map((opt) => {
                  const active = slackNotifyTypes.split(',').map((t) => t.trim()).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleSlackType(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        active
                          ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300'
                          : 'bg-gray-50 dark:bg-gray-900 border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {active ? '✓ ' : ''}{opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save & Test */}
            <div className="flex items-center gap-3 pt-2 flex-wrap">
              <button
                onClick={handleSlackSave}
                disabled={slackSaving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
              >
                {slackSaving ? '保存中...' : '保存'}
              </button>
              <button
                onClick={handleSlackTest}
                disabled={slackTesting || !slackWebhookConfigured}
                title={!slackWebhookConfigured ? '先にWebhook URLを保存してください' : 'テスト通知を送信'}
                className="px-4 py-2 border border-purple-600 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {slackTesting ? '送信中...' : '🔔 テスト送信'}
              </button>
              {slackSaveMessage && (
                <span className={`text-sm font-medium ${slackSaveMessage.includes('失敗') ? 'text-red-600' : 'text-green-600'}`}>
                  {slackSaveMessage}
                </span>
              )}
              {slackTestMessage && (
                <span className={`text-sm font-medium ${slackTestMessage.includes('失敗') ? 'text-red-600' : 'text-green-600'}`}>
                  {slackTestMessage}
                </span>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Section 3: Alert History */}
      <Card className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">アラート履歴</h2>

        {alertsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">アラート履歴はまだありません</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-default)] text-left">
                    <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">日時</th>
                    <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">タイプ</th>
                    <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">ドメイン</th>
                    <th className="py-2 pr-3 font-medium text-[var(--text-secondary)]">件名</th>
                    <th className="py-2 font-medium text-[var(--text-secondary)]">ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert: any) => (
                    <tr key={alert.id} className="border-b border-[var(--border-subtle)]">
                      <td className="py-2 pr-3 text-xs text-[var(--text-secondary)] whitespace-nowrap">
                        {new Date(alert.createdAt).toLocaleString('ja-JP')}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {TYPE_LABELS[alert.type] || alert.type}
                        </span>
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs">{alert.domain || '—'}</td>
                      <td className="py-2 pr-3 text-xs max-w-xs truncate">{alert.subject || '—'}</td>
                      <td className="py-2">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            alert.status === 'sent'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {alert.status === 'sent' ? '送信済' : '失敗'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-[var(--text-secondary)]">
                ページ {page} / {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 border border-[var(--border-default)] rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  前へ
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 border border-[var(--border-default)] rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  次へ
                </button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
