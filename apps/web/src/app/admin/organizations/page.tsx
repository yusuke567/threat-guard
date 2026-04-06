'use client';

import { useState, useEffect } from 'react';
import { PageHeader, Button, Card, Alert } from '@/components/ui';
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
        <div className="mb-6">
          <PageHeader title="Organization 管理" />
        </div>

        {error && (
          <Alert variant="error" className="mb-4 p-3 text-sm">{error}</Alert>
        )}

        {/* New Organization Form */}
        <Card padding="sm" className="mb-6">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">新規 Organization 作成</h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Organization名を入力"
              className="flex-1 px-3 py-2 border border-[var(--border-default)] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Button
              type="submit"
              disabled={creating || !newName.trim()}
            >
              {creating ? '作成中...' : '作成'}
            </Button>
          </form>
        </Card>

        {/* Organization List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-[var(--border-default)]">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">Organization名</th>
                  <th className="text-center px-4 py-3 font-medium text-[var(--text-secondary)]">ブランド数</th>
                  <th className="text-center px-4 py-3 font-medium text-[var(--text-secondary)]">ユーザー数</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--text-secondary)]">作成日</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orgs.map(org => (
                  <tr key={org.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{org.name}</td>
                    <td className="px-4 py-3 text-center text-[var(--text-secondary)]">{org._count.brands}</td>
                    <td className="px-4 py-3 text-center text-[var(--text-secondary)]">{org._count.users}</td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">{new Date(org.createdAt).toLocaleDateString('ja-JP')}</td>
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
                    <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-tertiary)]">
                      Organization がありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AdminGuard>
  );
}
