import type { Meta, StoryObj } from '@storybook/react-vite'
import { AllergyBanner } from '@/components/v3'

const meta: Meta<typeof AllergyBanner> = {
  title: 'v3/AllergyBanner',
  component: AllergyBanner,
}

export default meta
type Story = StoryObj<typeof AllergyBanner>

export const Safe: Story = {
  args: {
    dogName: '초롱',
    dogAllergies: ['chicken', 'beef'],
    productAllergens: ['lamb'],
  },
}

export const Danger: Story = {
  args: {
    dogName: '초롱',
    dogAllergies: ['chicken', 'beef'],
    productAllergens: ['chicken', 'duck'],
  },
}
