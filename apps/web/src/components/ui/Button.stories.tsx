import type { Meta, StoryObj } from '@storybook/react';
import Button from './Button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'danger', 'ghost'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: '削除申請', variant: 'primary' },
};

export const Secondary: Story = {
  args: { children: '詳細を確認', variant: 'secondary' },
};

export const Danger: Story = {
  args: { children: '脅威を報告', variant: 'danger' },
};

export const Ghost: Story = {
  args: { children: 'キャンセル', variant: 'ghost' },
};

export const Small: Story = {
  args: { children: '編集', variant: 'primary', size: 'sm' },
};

export const Large: Story = {
  args: { children: 'ブランドを登録', variant: 'primary', size: 'lg' },
};

export const Disabled: Story = {
  args: { children: '保存中...', variant: 'primary', disabled: true },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};
