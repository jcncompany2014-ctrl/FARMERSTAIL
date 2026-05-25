import type { Meta, StoryObj } from '@storybook/react-vite'
import { Badge } from '@/components/v3'

const meta: Meta<typeof Badge> = {
  title: 'v3/Badge',
  component: Badge,
  argTypes: {
    tone: {
      control: 'select',
      options: ['default', 'ink', 'sage', 'accent', 'sale', 'yellow'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md'],
    },
    shape: {
      control: 'select',
      options: ['rect', 'pill'],
    },
    filled: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = {
  args: { children: 'NEW', tone: 'accent', size: 'sm' },
}

export const Sage: Story = {
  args: { children: '구독중', tone: 'sage', size: 'sm', filled: true },
}

export const Pill: Story = {
  args: { children: '환불 가능', tone: 'ink', shape: 'pill' },
}

export const Sale: Story = {
  args: { children: '-30%', tone: 'sale', filled: true },
}
