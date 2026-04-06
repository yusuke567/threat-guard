import type { Meta, StoryObj } from '@storybook/react';
import Icon from './Icon';
import type { IconName } from './Icon';

const allIcons: IconName[] = [
  'shield', 'search', 'globe', 'lock', 'camera', 'bell',
  'trash', 'alertTriangle', 'chart', 'refresh', 'lightbulb', 'building',
];

const meta: Meta<typeof Icon> = {
  title: 'UI/Icon',
  component: Icon,
  argTypes: {
    name: { control: 'select', options: allIcons },
    size: { control: { type: 'range', min: 12, max: 48, step: 4 } },
  },
};

export default meta;
type Story = StoryObj<typeof Icon>;

export const Default: Story = {
  args: { name: 'shield', size: 24 },
};

export const AllIcons: Story = {
  render: () => (
    <div className="grid grid-cols-4 gap-6">
      {allIcons.map((name) => (
        <div key={name} className="flex flex-col items-center gap-2 p-4 rounded-lg border border-[var(--border-default)]">
          <Icon name={name} size={24} className="text-[var(--text-primary)]" />
          <span className="text-xs text-[var(--text-secondary)] font-mono">{name}</span>
        </div>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-6">
      {[14, 16, 20, 24, 32].map((size) => (
        <div key={size} className="flex flex-col items-center gap-2">
          <Icon name="shield" size={size} className="text-brand-600" />
          <span className="text-xs text-[var(--text-tertiary)]">{size}px</span>
        </div>
      ))}
    </div>
  ),
};

export const BrandColored: Story = {
  render: () => (
    <div className="flex gap-4">
      <Icon name="shield" size={24} className="text-brand-600" />
      <Icon name="alertTriangle" size={24} className="text-red-500" />
      <Icon name="chart" size={24} className="text-green-500" />
      <Icon name="bell" size={24} className="text-yellow-500" />
    </div>
  ),
};
