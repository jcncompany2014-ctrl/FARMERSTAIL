import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { Slider } from '@/components/v3'

const meta: Meta<typeof Slider> = {
  title: 'v3/Slider',
  component: Slider,
}

export default meta
type Story = StoryObj<typeof Slider>

function Interactive({
  min = 0,
  max = 50,
  step = 0.1,
  unit = 'kg',
  tone = 'ink',
  initial = 5,
  label = '체중',
}: {
  min?: number
  max?: number
  step?: number
  unit?: string
  tone?: 'ink' | 'accent' | 'sage'
  initial?: number
  label?: string
}) {
  const [v, setV] = useState(initial)
  return (
    <div style={{ width: 280 }}>
      <Slider
        value={v}
        onChange={setV}
        min={min}
        max={max}
        step={step}
        unit={unit}
        tone={tone}
        ariaLabel={label}
      />
    </div>
  )
}

export const Weight: Story = {
  render: () => <Interactive label="체중" />,
}

export const BCS: Story = {
  render: () => (
    <Interactive
      min={1}
      max={9}
      step={1}
      unit=""
      tone="accent"
      initial={5}
      label="BCS"
    />
  ),
}
