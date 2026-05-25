import type { Preview } from '@storybook/react-vite'
import '../app/globals.css'

/**
 * v3 primitive 는 `data-ft-chrome="app"` 스코프 안에서만 v3 토큰을 받는다.
 * 모든 stories 의 wrapper 에 강제 attach.
 */
const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'paper',
      values: [
        { name: 'paper', value: '#f4ede0' },
        { name: 'paperHi', value: '#fbf6ec' },
        { name: 'ink', value: '#16140f' },
      ],
    },
  },
  decorators: [
    (Story) => (
      <div data-ft-chrome="app" style={{ padding: 24, minWidth: 280 }}>
        <Story />
      </div>
    ),
  ],
}

export default preview
