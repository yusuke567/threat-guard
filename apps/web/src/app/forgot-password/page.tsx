'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Card, Alert, ShieldLogo } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'エラーが発生しました');
      }
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <ShieldLogo size={48} />
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-4">ThreatGuard</h1>
          <p className="text-[var(--text-secondary)] mt-1">パスワードの再設定</p>
        </div>

        <Card padding="lg" className="space-y-5">
          {sent ? (
            <div className="text-center space-y-4">
              <Alert variant="success" className="p-3 text-sm">
                パスワード再設定用のメールを送信しました。メールをご確認ください。
              </Alert>
              <Link
                href="/login"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
              >
                ログインに戻る
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="error" className="p-3 text-sm">
                  {error}
                </Alert>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">メールアドレス</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  name="email"
                  className="w-full border border-[var(--border-default)] rounded-lg px-4 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none dark:bg-gray-700 dark:text-gray-100"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full py-2.5"
              >
                {loading ? '送信中...' : '再設定メールを送信'}
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                >
                  ログインに戻る
                </Link>
              </div>
            </form>
          )}
        </Card>

        <p className="text-center text-xs text-[var(--text-tertiary)] mt-4">
          ThreatGuard v0.1.0 - Brand Protection Dashboard
        </p>
      </div>
    </div>
  );
}
