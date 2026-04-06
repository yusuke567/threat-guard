import type { Meta, StoryObj } from '@storybook/react';
import Input from './Input';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: 'ドメインを検索...',
  },
};

export const WithLabel: Story = {
  args: {
    label: 'メールアドレス',
    placeholder: 'you@example.com',
    type: 'email',
  },
};

export const WithHint: Story = {
  args: {
    label: '検知キーワード',
    placeholder: 'マイブランド, mybrand',
    hint: 'ブランドの別名・略称・日本語名など。カンマ区切りで入力。',
  },
};

export const Disabled: Story = {
  args: {
    label: 'ドメイン',
    value: 'example.com',
    disabled: true,
  },
};

export const Password: Story = {
  args: {
    label: 'パスワード',
    type: 'password',
    placeholder: '••••••••',
  },
};
