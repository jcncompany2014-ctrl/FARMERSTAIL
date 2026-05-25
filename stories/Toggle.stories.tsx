import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Toggle } from '@/components/v3'

const meta: Meta<typeof Toggle> = {
  title: 'v3/Toggle',
  component: Toggle,
}

export default meta
type Story = StoryObj<typeof Toggle>

function Interactive({ tone, size }: { tone?: 'ink' | 'accent' | 'sage'; size?: 'sm' | 'md' }) {
  const [on, setOn] = useState(false)
  return (
    <Toggle
      checked={on}
      onChange={setOn}
      tone={tone}
      size={size}
      ariaLabel="알림"
    />
  )
}

export const Ink: Story = {
  render: () => <Interactive tone="ink" />,
}

export const Accent: Story = {
  render: () => <Interactive tone="accent" />,
}

export const Sage: Story = {
  render: () => <Interactive tone="sage" />,
}

export const Small: Story = {
  render: () => <Interactive size="sm" />,
}
