# nuxt-chem-ui

Chemistry-focused UI components for [Nuxt](https://nuxt.com) — molecule and formula rendering, chemical data display, and more. Distributed as a Nuxt module.

## Status

Early development. Current components:

- `<ChemMolecularFormula>` — renders molecular formula strings (`CuSO4·5H2O`) with proper subscripts.

## Usage

```bash
pnpm add nuxt-chem-ui
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-chem-ui'],
})
```

```vue
<template>
  <ChemMolecularFormula formula="C6H12O6" />
</template>
```

Tailwind CSS v4 is set up automatically by the module. If your app already uses Tailwind v4, disable the injected entry and source the package yourself:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-chem-ui'],
  chemUi: { css: false },
})
```

```css
/* app.css */
@import "tailwindcss";
@source "../node_modules/nuxt-chem-ui";
```

## Development

```bash
pnpm install        # also stub-builds dist/
pnpm dev            # playground at http://localhost:3000
pnpm test           # vitest
pnpm lint           # eslint
pnpm typecheck     # vue-tsc
pnpm build          # build the module into dist/
```

See [AGENTS.md](./AGENTS.md) for the full contributor guide (structure, conventions, adding components).
