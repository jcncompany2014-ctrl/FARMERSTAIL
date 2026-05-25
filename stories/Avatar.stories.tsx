import type { Meta, StoryObj } from '@storybook/react-vite'
import { Avatar } from '@/components/v3'

const meta: Meta<typeof Avatar> = {
  title: 'v3/Avatar',
  component: Avatar,
  argTypes: {
    size: { control: { type: 'range', min: 24, max: 96, step: 4 } },
    tone: {
      control: 'select',
      options: ['auto', 'accent', 'sage', 'yellow', 'blue', 'ink'],
    },
    status: {
      control: 'select',
      options: [undefined, 'online', 'offline', 'new'],
    },
  },
}

export default meta
type Story = StoryObj<typeof Avatar>

export const Initial: Story = {
  args: { name: '초롱', size: 40, tone: 'auto' },
}

export const Hash: Story = {
  args: { name: '복실이', size: 48 },
}

export const WithStatus: Story = {
  args: { name: '코코', size: 56, tone: 'sage', status: 'online' },
}

export const English: Story = {
  args: { name: 'Maxwell', size: 64, tone: 'accent' },
}
