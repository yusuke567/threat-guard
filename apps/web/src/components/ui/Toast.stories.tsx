'use client';

import type { Meta, StoryObj } from '@storybook/react';
import { ToastProvider, useToast } from './Toast';
import Button from './Button';

function ToastDemo() {
  const toast = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="primary" onClick={() => toast.success('スキャンを開始しました')}>
        Success
      </Button>
      <Button variant="danger" onClick={() => toast.error('アップロードに失敗しました')}>
        Error
      </Button>
      <Button variant="ghost" onClick={() => toast.info('誤検知マーク機能は実装予定です')}>
        Info
      </Button>
      <Button variant="secondary" onClick={() => toast.warning('ファイルサイズは2MB以下にしてください')}>
        Warning
      </Button>
    </div>
  );
}

const meta: Meta = {
  title: 'UI/Toast',
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => <ToastDemo />,
};
