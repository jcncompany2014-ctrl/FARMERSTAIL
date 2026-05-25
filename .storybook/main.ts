import type { StorybookConfig } from '@storybook/nextjs-vite'

/**
 * Storybook config (R18-D35).
 *
 * v3 primitive 카탈로그 — 디자인 검토 / 회귀 방지.
 * Next.js + Vite 어댑터. CSS import 는 preview.ts 에서.
 *
 * 실행:
 *   npm run storybook       — dev mode (port 6006)
 *   npm run build-storybook — static export
 */
const config: StorybookConfig = {
  stories: ['../stories/**/*.stories.@(ts|tsx)'],
  addons: [],
  framework: {
    name: '@storybook/nextjs-vite',
    options: {},
  },
}

export default config
