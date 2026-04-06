import type { Meta, StoryObj } from '@storybook/react';
import Alert from './Alert';

const meta: Meta<typeof Alert> = {
  title: 'UI/Alert',
  component: Alert,
  argTypes: {
    variant: { control: 'select', options: ['info', 'success', 'warning', 'error'] },
  },
};

export default meta;
type Story = StoryObj<typeof Alert>;

export const Info: Story = {
  args: {
    variant: 'info',
    children: <p className="text-sm">ブランドを登録すると自動スキャンが開始されます。</p>,
  },
};

export const Success: Story = {
  args: {
    variant: 'success',
    children: <p className="text-sm">削除申請が正常に送信されました。</p>,
  },
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    children: <p className="text-sm">リスクスコアが上昇しています。確認してください。</p>,
  },
};

export const Error: Story = {
  args: {
    variant: 'error',
    children: (
      <div>
        <p className="font-medium">エラーが発生しました</p>
        <p className="text-sm mt-1">APIサーバーに接続できませんでした。</p>
      </div>
    ),
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-3">
      <Alert variant="info">情報メッセージ</Alert>
      <Alert variant="success">成功メッセージ</Alert>
      <Alert variant="warning">警告メッセージ</Alert>
      <Alert variant="error">エラーメッセージ</Alert>
    </div>
  ),
};
