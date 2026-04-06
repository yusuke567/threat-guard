import type { Meta, StoryObj } from '@storybook/react';
import Tooltip from './Tooltip';

const meta: Meta<typeof Tooltip> = {
  title: 'Domain/Tooltip',
  component: Tooltip,
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  args: {
    content: 'リスクスコア（0〜100）はドメイン類似度（30%）・ドメイン年齢（20%）・SSL状態（15%）・脅威分類（25%）・コンテンツ類似度（10%）から自動算出されます。',
  },
  decorators: [
    (Story) => (
      <div className="p-20 flex items-center gap-2">
        <span className="text-sm text-[var(--text-secondary)]">リスクスコア</span>
        <Story />
      </div>
    ),
  ],
};
