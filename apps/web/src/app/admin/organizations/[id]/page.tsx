'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import AdminGuard from '@/components/AdminGuard';
import { getOrganization, updateOrganization, getOrgUsers, createOrgUser, deleteOrgUser, getDeletedOrgUsers, restoreOrgUser } from '@/lib/api';

interface OrgDetail {
  id: string;
  name: string;
  brands: { id: string; name: string; domain: string }[];
  _count: { brands: number; users: number };
}

interface OrgUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  deletedAt?: string | null;
}

export default function AdminOrgDetailPage() {
  const params = useParams();
  const orgId = params.id as string;

  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [deletedUsers, setDeletedUsers] = useState<OrgUser[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit name
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    try {
      const [orgData, usersData, deletedData] = await Promise.all([
        getOrganization(orgId),
        getOrgUsers(orgId),
        getDeletedOrgUsers(orgId),
      ]);
      setOrg(orgData);
      setEditName(orgData.name);
      setUsers(usersData);
      setDeletedUsers(deletedData);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [orgId]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await updateOrganization(orgId, editName.trim());
      setOrg(prev => prev ? { ...prev, name: updated.name } : prev);
      setSuccess('Organization名を更新しました');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !invitePassword) return;
    setInviting(true);
    setError('');
    setSuccess('');
    try {
      await createOrgUser(orgId, {
        email: inviteEmail,
        name: inviteName || undefined,
        password: invitePassword,
        role: inviteRole,
      });
      setInviteEmail('');
      setInviteName('');
      setInvitePassword('');
      setInviteRole('member');
      setSuccess('ユーザーを追加しました');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setInviting(false);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`${email} を無効化しますか？`)) return;
    setError('');
    setSuccess('');
    try {
      await deleteOrgUser(orgId, userId);
      setSuccess('ユーザーを無効化しました');
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRestoreUser = async (userId: string, email: string) => {
    if (!confirm(`${email} を復元しますか？`)) return;
    setError('');
    setSuccess('');
    try {
      await restoreOrgUser(orgId, userId);
      setSuccess('ユーザーを復元しました');
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <AdminGuard>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </AdminGuard>
    );
  }

  if (!org) {
    return (
      <AdminGuard>
        <div className="text-center py-20 text-gray-500 dark:text-gray-400 dark:text-gray-500">Organization が見つかりません</div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div>
        <div className="mb-6">
          <a href="/admin/organizations" className="text-blue-600 hover:text-blue-700 dark:text-blue-300 text-sm font-medium">
            &larr; Organization 一覧に戻る
          </a>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">{org.name}</h1>

        {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm">{success}</div>}

        {/* Edit Name */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Organization 情報</h2>
          <form onSubmit={handleUpdateName} className="flex gap-3">
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={saving || !editName.trim() || editName.trim() === org.name}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '保存中...' : '名前を更新'}
            </button>
          </form>
        </div>

        {/* Brands */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
            所属ブランド ({org.brands.length})
          </h2>
          {org.brands.length > 0 ? (
            <div className="space-y-2">
              {org.brands.map(brand => (
                <div key={brand.id} className="flex items-center gap-3 py-2 px-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{brand.name}</span>
                  <span className="text-gray-400 dark:text-gray-500 text-xs">{brand.domain}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">ブランドがありません</p>
          )}
        </div>

        {/* Users */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
            所属ユーザー ({users.length})
          </h2>
          {users.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-300">メール</th>
                  <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-300">名前</th>
                  <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-300">ロール</th>
                  <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-300">作成日</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:bg-gray-900">
                    <td className="py-2 text-gray-900 dark:text-gray-100">{u.email}</td>
                    <td className="py-2 text-gray-600 dark:text-gray-300">{u.name || '—'}</td>
                    <td className="py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2 text-gray-500 dark:text-gray-400 dark:text-gray-500">{new Date(u.createdAt).toLocaleDateString('ja-JP')}</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => handleDeleteUser(u.id, u.email)}
                        className="text-red-500 hover:text-red-700 dark:text-red-300 text-xs font-medium"
                      >
                        無効化
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">ユーザーがいません</p>
          )}
        </div>

        {/* Deleted Users */}
        {deletedUsers.length > 0 && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
            <button
              onClick={() => setShowDeleted(prev => !prev)}
              className="text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400"
            >
              {showDeleted ? '削除済みユーザーを非表示' : `削除済みユーザーを表示 (${deletedUsers.length}件)`}
            </button>
            {showDeleted && (
              <table className="w-full text-sm mt-3">
                <thead className="border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-300">メール</th>
                    <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-300">名前</th>
                    <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-300">ロール</th>
                    <th className="text-left py-2 font-medium text-gray-600 dark:text-gray-300">削除日</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deletedUsers.map(u => (
                    <tr key={u.id} className="opacity-60 hover:opacity-100">
                      <td className="py-2 text-gray-500 dark:text-gray-400">{u.email}</td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">{u.name || '—'}</td>
                      <td className="py-2">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          {u.role}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">{u.deletedAt ? new Date(u.deletedAt).toLocaleDateString('ja-JP') : '—'}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => handleRestoreUser(u.id, u.email)}
                          className="text-blue-500 hover:text-blue-700 dark:text-blue-300 text-xs font-medium"
                        >
                          復元
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Invite User */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">ユーザー招待</h2>
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">メールアドレス *</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">名前</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">パスワード * (8文字以上)</label>
                <input
                  type="password"
                  value={invitePassword}
                  onChange={e => setInvitePassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mb-1">ロール</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="member">member</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={inviting || !inviteEmail || !invitePassword}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {inviting ? '追加中...' : 'ユーザーを追加'}
            </button>
          </form>
        </div>
      </div>
    </AdminGuard>
  );
}
