// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'

export default createConfigForNuxt({
  dirs: ['src', 'test', 'playground'],
}).append(
  // Tool-generated skill scaffolding, not project code
  { ignores: ['.agents/**', '.zcode/**', 'skills-lock.json'] },
  // Nuxt pages use single-word file names like index.vue by convention
  {
    files: ['playground/app/pages/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
)
