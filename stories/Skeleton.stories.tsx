import type { Meta, StoryObj } from '@storybook/react-vite'
import { Skeleton, SkeletonStack } from '@/components/v3'

const meta: Meta<typeof Skeleton> = {
  title: 'v3/Skeleton',
  component: Skeleton,
}

export default meta
type Story = StoryObj<typeof Skeleton>

export const Line: Story = { args: { shape: 'line', width: 240 } }
export const Circle: Story = { args: { shape: 'circle' } }
export const Card: Story = { args: { shape: 'card', width: 280 } }
export const Hero: Story = { args: { shape: 'hero', width: 320 } }
export const Stack: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <SkeletonStack lines={3} gap={8} />
    </div>
  ),
}
