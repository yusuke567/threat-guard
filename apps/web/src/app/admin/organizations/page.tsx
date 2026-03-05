'use client';

import { useState, useEffect } from 'react';
import AdminGuard from '@/components/AdminGuard';
import { getAllOrganizations, createOrganization } from '@/lib/api';

interface Org {
  id: string;
  name: string;
  createdAt: string;
  _count: { brands: number; users: number };
}

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await getAllOrganizations();
      setOrgs(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      await createOrganization(newName.trim());
      setNewName('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <AdminGuard>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Organization 管理</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>
        )}

        {/* New Organization Form */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">新規 Organization 作成</h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Organization名を入力"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? '作成中...' : '作成'}
            </button>
          </form>
        </div>

        {/* Organization List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Organization名</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-300">ブランド数</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-300">ユーザー数</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-300">作成日</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orgs.map(org => (
                  <tr key={org.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{org.name}</td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{org._count.brands}</td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{org._count.users}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 dark:text-gray-500">{new Date(org.createdAt).toLocaleDateString('ja-JP')}</td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`/admin/organizations/${org.id}`}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-300 font-medium"
                      >
                        詳細
                      </a>
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400 dark:text-gray-500">
                      Organization がありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminGuard>
  );
}
