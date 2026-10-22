# nuxt-chem-ui

Chemistry-focused UI components for [Nuxt](https://nuxt.com) — molecule and formula rendering, chemical data display, and more. Distributed as a Nuxt module.

## Status

Early development. Current components:

- `<ChemMolecularFormula>` — renders molecular formula strings (`CuSO4·5H2O`) with proper subscripts.
- `<ChemKekulePeriodicTable>` — interactive periodic table with two-way element selection (Kekule.js engine, lazy-loaded client-side).
- `<ChemKekuleComposer>` — 2D molecule structure editor with MOL/CML export (Kekule.js engine, lazy-loaded client-side).
- `useChemKekuleWidget()` — composable underpinning the Kekule wrappers (widget lifecycle, prop sync, event bridging).

## Usage

Install from a [GitHub Release](https://github.com/AnsonZhang2009/nuxt-chem-ui/releases) tarball (prebuilt, no install scripts):

```bash
pnpm add https://github.com/AnsonZhang2009/nuxt-chem-ui/releases/download/v0.1.0/nuxt-chem-ui-0.1.0.tgz
```

or straight from GitHub (pnpm builds it on install — approve the build once):

```bash
pnpm add github:AnsonZhang2009/nuxt-chem-ui
```

```yaml
# pnpm-workspace.yaml (pnpm 10.26+)
allowBuilds:
  'nuxt-chem-ui@git+https://github.com/AnsonZhang2009/nuxt-chem-ui.git': true
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
pnpm install        # also builds dist/ (real build via prepare)
pnpm dev            # playground at http://localhost:3000
pnpm test           # vitest
pnpm lint           # eslint
pnpm typecheck     # vue-tsc
pnpm build          # build the module into dist/
```

See [AGENTS.md](./AGENTS.md) for the full contributor guide (structure, conventions, adding components).
