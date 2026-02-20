import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BrandShield - Brand Protection Dashboard',
  description: 'Detect and take down brand impersonation threats',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="min-h-screen">
          <nav className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <a href="/" className="flex items-center gap-2">
                <span className="text-2xl">🛡️</span>
                <span className="text-xl font-bold text-gray-900">BrandShield</span>
              </a>
              <div className="flex gap-6">
                <a href="/" className="text-gray-600 hover:text-gray-900 font-medium">ダッシュボード</a>
                <a href="/threats" className="text-gray-600 hover:text-gray-900 font-medium">脅威一覧</a>
                <a href="/brands" className="text-gray-600 hover:text-gray-900 font-medium">ブランド管理</a>
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto px-6 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
