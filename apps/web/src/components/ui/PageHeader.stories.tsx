import type { Meta, StoryObj } from '@storybook/react';
import PageHeader from './PageHeader';
import Button from './Button';

const meta: Meta<typeof PageHeader> = {
  title: 'UI/PageHeader',
  component: PageHeader,
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const TitleOnly: Story = {
  args: { title: 'Organization 管理' },
};

export const WithDescription: Story = {
  args: {
    title: '脅威一覧',
    description: '検知されたなりすまし脅威の監視・管理',
  },
};

export const WithActions: Story = {
  args: {
    title: 'ブランド管理',
    description: '監視対象のブランドを管理',
    actions: (
      <>
        <Button variant="ghost">CSV一括登録</Button>
        <Button>+ ブランド追加</Button>
      </>
    ),
  },
};
