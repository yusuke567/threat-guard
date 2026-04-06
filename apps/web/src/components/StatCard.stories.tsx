import type { Meta, StoryObj } from '@storybook/react';
import StatCard from './StatCard';

const meta: Meta<typeof StatCard> = {
  title: 'Domain/StatCard',
  component: StatCard,
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Red: Story = {
  args: {
    title: '対応が必要',
    value: 12,
    icon: '🔴',
    color: 'red',
    subtitle: 'リスクスコア60以上',
  },
};

export const Yellow: Story = {
  args: {
    title: '確認待ち',
    value: 8,
    icon: '🟡',
    color: 'yellow',
    subtitle: 'リスクスコア40〜59',
  },
};

export const Green: Story = {
  args: {
    title: '対応済み',
    value: 42,
    icon: '🟢',
    color: 'green',
  },
};

export const Blue: Story = {
  args: {
    title: '検知総数',
    value: 128,
    icon: '📊',
    color: 'blue',
    tooltip: '過去30日間の検知数',
  },
};

export const AllColors: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 max-w-2xl">
      <StatCard title="対応が必要" value={12} icon="🔴" color="red" subtitle="リスクスコア60以上" />
      <StatCard title="確認待ち" value={8} icon="🟡" color="yellow" />
      <StatCard title="対応済み" value={42} icon="🟢" color="green" />
      <StatCard title="検知総数" value={128} icon="📊" color="blue" tooltip="過去30日間の検知数" />
    </div>
  ),
};
