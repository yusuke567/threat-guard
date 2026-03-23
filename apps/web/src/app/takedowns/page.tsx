'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTakedowns, updateTakedownStatus } from '@/lib/api';

const statusLabels: Record<string, string> = {
  draft: '📝 下書き',
  sent: '📨 送信済み',
  awaiting_response: '🟡 回答待ち',
  completed: '🟢 削除完了',
  rejected: '🔴 却下',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
  sent: 'bg-blue-100 text-blue-800',
  awaiting_response: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

function daysSince(date: string): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

export default function TakedownsPage() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    getTakedowns(params)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [statusFilter]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateTakedownStatus(id, newStatus);
      loadData();
    } catch (err) {
      console.error('Status update failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">削除申請の進捗</h1>
        <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">送信済みの削除申請のステータスを管理します</p>
      </div>

      {/* Summary Cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { key: 'total', label: '全件', color: 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700', textColor: 'text-gray-900 dark:text-gray-100' },
            { key: 'sent', label: '送信済み', color: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800', textColor: 'text-blue-700 dark:text-blue-300' },
            { key: 'awaiting_response', label: '回答待ち', color: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800', textColor: 'text-yellow-700 dark:text-yellow-300' },
            { key: 'completed', label: '削除完了', color: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800', textColor: 'text-green-700 dark:text-green-300' },
            { key: 'rejected', label: '却下', color: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800', textColor: 'text-red-700 dark:text-red-300' },
          ].map(({ key, label, color, textColor }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key === 'total' ? '' : key)}
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${color} ${
                (statusFilter === key || (key === 'total' && !statusFilter)) ? 'ring-2 ring-blue-400' : ''
              }`}
            >
              <div className={`text-2xl font-bold ${textColor}`}>{data.summary[key]}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">{label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Takedown Groups */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : data?.groups?.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">削除申請はまだありません</h3>
            <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm mb-4">脅威一覧から脅威を選択して削除申請を送信してください。</p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              脅威一覧へ
            </button>
          </div>
        ) : (
          data?.groups?.map((group: any, gi: number) => (
            <div key={gi} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Group Header */}
              <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      {group.recipientType === 'police' ? '🚔' : '📧'} {group.recipientName || group.registrar}
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400 dark:text-gray-500">— {group.items.length}件</span>
                      {group.recipientType === 'police' && (
                        <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-xs font-bold">警察通報</span>
                      )}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">
                      送信先: {group.abuseEmail || '不明'}
                      {group.createdAt && ` • 送信から${daysSince(group.createdAt)}日経過`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Individual Items */}
              <div className="divide-y divide-gray-100">
                {group.items.map((item: any) => (
                  <div key={item.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-medium truncate">{item.domain}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{item.brandName}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {item.rejectionReason && (
                        <span className="text-xs text-red-500" title={item.rejectionReason}>
                          理由: {item.rejectionReason.slice(0, 30)}
                        </span>
                      )}
                      <select
                        value={item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value)}
                        className={`text-xs font-medium rounded-full px-3 py-1 border-0 cursor-pointer ${statusColors[item.status] || 'bg-gray-100 dark:bg-gray-700'}`}
                      >
                        <option value="draft">📝 下書き</option>
                        <option value="sent">📨 送信済み</option>
                        <option value="awaiting_response">🟡 回答待ち</option>
                        <option value="completed">🟢 削除完了</option>
                        <option value="rejected">🔴 却下</option>
                      </select>

                      {item.status === 'rejected' && (
                        <button
                          onClick={() => {
                            // Re-send: store single threat id and go to wizard
                            sessionStorage.setItem('takedown_threat_ids', JSON.stringify([item.domain]));
                            // For now just navigate — full resend flow uses the resend API
                            alert('再申請機能: 脅威一覧から再度選択して申請してください。');
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          🔄 再申請
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
