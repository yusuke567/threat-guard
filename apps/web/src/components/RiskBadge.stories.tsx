import type { Meta, StoryObj } from '@storybook/react';
import { RiskBadgeCompact, RiskBadgeFull } from './RiskBadge';

const meta: Meta = {
  title: 'Domain/RiskBadge',
};

export default meta;
type Story = StoryObj;

export const CompactCritical: Story = {
  render: () => <RiskBadgeCompact score={92} threatId="t1" />,
};

export const CompactHigh: Story = {
  render: () => <RiskBadgeCompact score={68} />,
};

export const CompactMedium: Story = {
  render: () => <RiskBadgeCompact score={45} />,
};

export const CompactLow: Story = {
  render: () => <RiskBadgeCompact score={15} />,
};

export const CompactNull: Story = {
  render: () => <RiskBadgeCompact score={null} />,
};

export const CompactAll: Story = {
  render: () => (
    <div className="space-y-3">
      <RiskBadgeCompact score={92} threatId="t1" />
      <RiskBadgeCompact score={68} />
      <RiskBadgeCompact score={45} />
      <RiskBadgeCompact score={15} />
      <RiskBadgeCompact score={null} />
    </div>
  ),
};

export const FullCritical: Story = {
  render: () => <RiskBadgeFull score={92} />,
};

export const FullHigh: Story = {
  render: () => <RiskBadgeFull score={68} />,
};

export const FullMedium: Story = {
  render: () => <RiskBadgeFull score={45} />,
};

export const FullLow: Story = {
  render: () => <RiskBadgeFull score={15} />,
};

export const FullNull: Story = {
  render: () => <RiskBadgeFull score={null} />,
};
