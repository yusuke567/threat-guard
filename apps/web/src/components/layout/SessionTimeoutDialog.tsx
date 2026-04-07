'use client';

interface SessionTimeoutDialogProps {
  remainingSeconds: number;
  reason: 'idle' | 'session';
  onExtend: () => void;
  onLogout: () => void;
}

export default function SessionTimeoutDialog({
  remainingSeconds,
  reason,
  onExtend,
  onLogout,
}: SessionTimeoutDialogProps) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = minutes > 0
    ? `${minutes}分${seconds.toString().padStart(2, '0')}秒`
    : `${seconds}秒`;

  const message = reason === 'idle'
    ? '操作が検出されないため、まもなく自動ログアウトされます。'
    : 'セッションの有効期限が近づいています。';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
            <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            セッションタイムアウト
          </h2>
        </div>

        <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">
          {message}
        </p>

        <p className="mb-6 text-center text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
          {timeDisplay}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onLogout}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            ログアウト
          </button>
          <button
            onClick={onExtend}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            セッションを延長
          </button>
        </div>
      </div>
    </div>
  );
}
