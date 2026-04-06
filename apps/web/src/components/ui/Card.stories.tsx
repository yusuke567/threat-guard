import type { Meta, StoryObj } from '@storybook/react';
import Card from './Card';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  argTypes: {
    variant: { control: 'select', options: ['default', 'interactive', 'status'] },
    padding: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: (
      <div>
        <h3 className="font-bold text-[var(--text-primary)]">カードタイトル</h3>
        <p className="text-sm text-[var(--text-secondary)] mt-1">カードの説明テキスト</p>
      </div>
    ),
  },
};

export const Interactive: Story = {
  args: {
    variant: 'interactive',
    children: (
      <div>
        <h3 className="font-bold text-[var(--text-primary)]">クリック可能なカード</h3>
        <p className="text-sm text-[var(--text-secondary)] mt-1">ホバーで背景が変わります</p>
      </div>
    ),
  },
};

export const SmallPadding: Story = {
  args: {
    padding: 'sm',
    children: <p className="text-sm">コンパクトなカード (p-4)</p>,
  },
};

export const LargePadding: Story = {
  args: {
    padding: 'lg',
    children: <p>ゆったりとしたカード (p-8)</p>,
  },
};

export const StatCard: Story = {
  render: () => (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">検知数</p>
          <p className="text-3xl font-bold text-red-600 mt-1">128</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">過去30日間</p>
        </div>
        <span className="text-3xl opacity-50">🔴</span>
      </div>
    </Card>
  ),
};
