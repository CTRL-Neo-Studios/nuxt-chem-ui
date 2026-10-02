# AGENTS.md

Guide for AI coding agents (and humans) working in this repository.

## What this repo is

`nuxt-chem-ui` is a chemistry-focused UI component library for Nuxt, packaged as a **Nuxt module**. Consumers register it via `modules: ['nuxt-chem-ui']` and get components auto-registered with the **`Chem` prefix** (`<ChemMolecularFormula>`, …) plus `useChem*` composables.

Components come from two sources:
- **Custom-built** in this repo.
- **Bundled/refactored from other repos.** When refactoring a component in, add a short header comment in the file noting the source repo/path and its license, and strip anything the component doesn't need — don't vendor dead code.

## Ground rules

- **pnpm only.** Never use npm or yarn commands.
- Node >= 20, TypeScript everywhere. SFCs use `<script setup lang="ts">`.
- Tailwind CSS v4 utilities for styling (see *Styling* below). No runtime CSS framework dependencies beyond that.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm install` | Installs deps; the `prepare` script stub-builds `dist/` for local development |
| `pnpm dev` | Runs the playground dev server (the main dev loop) |
| `pnpm dev:prepare` | Stub build + prepare playground types (run after changing module setup or adding deps) |
| `pnpm build` | Builds the module into `dist/` |
| `pnpm build:playground` | Full production build of the playground — strongest smoke test |
| `pnpm test` / `pnpm test:watch` | Vitest |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm typecheck` | vue-tsc over the playground context |

## Repository layout

```
├── src/
│   ├── module.ts               # Module entry: registers components/composables/CSS
│   └── runtime/                # Everything that ships to consumers
│       ├── components/         # Vue components -> <Chem*> (prefix added by module)
│       ├── composables/        # useChem* composables, auto-imported in consuming apps
│       ├── utils/              # Pure, framework-free logic (parsing, chemistry data)
│       └── css/main.css        # Tailwind entry: @import "tailwindcss" + @source "../"
├── playground/                 # Dev/test app — demos of every component live here
│   ├── nuxt.config.ts          # modules: ['../src/module']
│   └── app/pages/              # Demo pages (components must not import from playground)
├── test/                       # Vitest, mirrors src/runtime structure
│   ├── components/             # Component tests (mountSuspended)
│   └── utils/                  # Unit tests for pure logic
├── vitest.config.ts            # environment: 'nuxt' via @nuxt/test-utils
└── eslint.config.mjs
```

The playground is a consumer, not part of the library: `src/runtime/**` must never import from `playground/**`.

## Adding a new component (checklist)

1. **Component:** create `src/runtime/components/Foo.vue`. It is auto-registered as `<ChemFoo>` (`prefix: 'Chem'`, `pathPrefix: false` — subdirectories still yield flat `Chem*` names). File names don't include the prefix.
2. **Logic:** pure logic (parsing, data transforms, chemistry constants) goes in `src/runtime/utils/` as exported, unit-tested functions. Components stay thin wrappers.
3. **Composables:** stateful behavior goes in `src/runtime/composables/useChemFoo.ts` (auto-imported).
4. **Styling:** Tailwind utilities only; classes in `src/runtime/**` are picked up automatically by `src/runtime/css/main.css` (`@source "../"`). Avoid `<style>` blocks unless truly necessary; if added, keep them scoped.
5. **SSR safety:** components touching `canvas`/`WebGL`/browser-only APIs must render client-side only — use a `.client.vue` suffix or wrap in `<ClientOnly>` with a fallback.
6. **Demo:** add a section to `playground/app/pages/index.vue`, or create a new page under `playground/app/pages/` for bigger components.
7. **Tests:** add `test/components/Foo.test.ts` and/or `test/utils/*.test.ts` mirroring the src path.
8. **Dependencies:** for a new runtime dependency, weigh bundle impact; heavy libs (cheminformatics toolkits, WebGL viewers) should be `dependencies` + dynamically imported inside the client-only component.

## Testing conventions

- Vitest with `environment: 'nuxt'` (`@nuxt/test-utils`).
- Pure utils: plain `describe`/`it` — no mounting.
- Components: `import { mountSuspended } from '@nuxt/test-utils/runtime'` and import the `.vue` file **directly from `src/`** (don't rely on global registration — that is the module's job, verified by the playground building).
- Tests live under `test/`, never inside `src/`.

## Styling & Tailwind notes

- The module injects `src/runtime/css/main.css` (`@import "tailwindcss"` + `@source`) and registers the `@tailwindcss/vite` plugin automatically — consuming apps need zero Tailwind setup.
- Apps that already run Tailwind v4 set `chemUi: { css: false }` and add `@source "../node_modules/nuxt-chem-ui";` to their own CSS.
- Vite builder only (Nuxt default). Webpack builds are not supported.
- Prefer neutral utilities that inherit from the app (currentColor, text-inherit) so components theme well in light and dark mode; add `dark:` variants where needed.

## Versioning / publishing

`dist/` is build output (gitignored). Publishing isn't set up yet: when needed, remove `"private": true` in `package.json`, add a `release` script, and use the existing `build` output (`dist/module.mjs` / `.cjs` are already wired in `exports`).
