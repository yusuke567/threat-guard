'use client';

import { useState } from 'react';
import { PageHeader, Button, Card, Alert } from '@/components/ui';
import AdminGuard from '@/components/layout/AdminGuard';
import { triggerWhoisBackfill } from '@/lib/api';

export default function SystemAdminPage() {
  const [backfilling, setBackfilling] = useState(false);
  const [result, setResult] = useState<{
    message: string;
    processing: number;
    totalMissing: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(50);

  const handleBackfill = async () => {
    setBackfilling(true);
    setError(null);
    setResult(null);
    try {
      const res = await triggerWhoisBackfill(batchSize);
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'バックフィルの実行に失敗しました');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <AdminGuard>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <PageHeader
          title="システム管理"
          description="データメンテナンスや一括処理を実行します"
        />

        <div className="mt-8 space-y-6">
          {/* WHOIS Backfill */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
                WHOISデータ一括取得
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                レジストラ情報が未取得の検知ドメインに対して、RDAPプロトコル経由でWHOISデータを一括取得します。
                バックグラウンドで処理されるため、ページを閉じても実行は継続します。
              </p>

              <div className="flex items-center gap-4 mb-4">
                <label className="text-sm text-[var(--text-secondary)]">
                  バッチサイズ:
                </label>
                <select
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] px-3 py-1.5 text-sm"
                  disabled={backfilling}
                >
                  <option value={20}>20件</option>
                  <option value={50}>50件</option>
                  <option value={100}>100件</option>
                  <option value={200}>200件</option>
                </select>
              </div>

              <Button
                variant="primary"
                size="md"
                onClick={handleBackfill}
                disabled={backfilling}
              >
                {backfilling ? '実行中...' : 'WHOIS一括取得を実行'}
              </Button>

              {result && (
                <Alert variant="success" className="mt-4">
                  <p className="font-medium">{result.message}</p>
                  <p className="text-sm mt-1">
                    処理対象: {result.processing}件 / 未取得合計: {result.totalMissing}件
                  </p>
                  {result.totalMissing > result.processing && (
                    <p className="text-sm mt-1 text-[var(--text-secondary)]">
                      残り{result.totalMissing - result.processing}件は再度実行してください
                    </p>
                  )}
                </Alert>
              )}

              {error && (
                <Alert variant="error" className="mt-4">
                  {error}
                </Alert>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AdminGuard>
  );
}
