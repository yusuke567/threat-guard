'use client';

import { useEffect, useState } from 'react';
import { getAlerts, getAlertSettings, updateAlertSettings } from '@/lib/api';

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

  // History state
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 20;

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">🔔 通知設定</h1>
        <p className="text-gray-500 mt-1">アラート通知の設定と送信履歴</p>
      </div>

      {/* Section 1: Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <h2 className="text-lg font-bold text-gray-900">通知設定</h2>

        {settingsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <>
            {/* Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">メールアラート</p>
                <p className="text-sm text-gray-500">脅威検知時にメールで通知を受け取る</p>
              </div>
              <button
                onClick={() => setAlertEnabled(!alertEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  alertEnabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    alertEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Threshold */}
            <div>
              <label className="block font-medium text-gray-900 mb-1">リスクスコア閾値</label>
              <p className="text-sm text-gray-500 mb-3">
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
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <span className="text-lg font-bold text-blue-600 w-12 text-right">{alertThreshold}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
                <span>0</span>
                <span>50</span>
                <span>100</span>
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
              {saveMessage && (
                <span
                  className={`text-sm font-medium ${
                    saveMessage.includes('失敗') ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {saveMessage}
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Section 2: Alert History */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">アラート履歴</h2>

        {alertsLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">アラート履歴はまだありません</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="py-2 pr-3 font-medium text-gray-600">日時</th>
                    <th className="py-2 pr-3 font-medium text-gray-600">タイプ</th>
                    <th className="py-2 pr-3 font-medium text-gray-600">ドメイン</th>
                    <th className="py-2 pr-3 font-medium text-gray-600">件名</th>
                    <th className="py-2 font-medium text-gray-600">ステータス</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert: any) => (
                    <tr key={alert.id} className="border-b border-gray-100">
                      <td className="py-2 pr-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(alert.createdAt).toLocaleString('ja-JP')}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
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
              <p className="text-sm text-gray-500">
                ページ {page} / {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  前へ
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  次へ
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
