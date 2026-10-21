# Kekule Widget Components — Implementation Plan

> Source of truth for refactoring [Kekule-Vue](https://github.com/partridgejiang/Kekule-Vue) into
> nuxt-chem-ui. Work the three projects **in order**; each is self-contained and ends with the
> full verification gate, so any project can be picked up in a fresh session.
>
> Branch: `feature/kekule-widgets`.

## Context

- **Pattern source:** [partridgejiang/Kekule-Vue](https://github.com/partridgejiang/Kekule-Vue)
  (MIT, © 2022 partridgejiang) — official Vue 3 wrapper for Kekule.js widgets by the Kekule.js
  author. Dormant since Jan 2023. We borrow its widget-wiring knowledge (prop/event bridging,
  the `modelUpdateEventMap` compensation idea, the `getSavingTargetObj` trick), **not** its code
  architecture.
- **Engine:** [`kekule` npm](https://www.npmjs.com/package/kekule) ^1.0.4 — used as a dependency,
  never vendored (Kekule.js itself is LGPL-2.1; only this thin wrapper derives from MIT-licensed
  Kekule-Vue).
- Each file that derives from Kekule-Vue carries a header comment crediting the source repo,
  path, and MIT license (AGENTS.md rule).

## Global decisions

| Topic | Decision |
| --- | --- |
| Naming | Bundled-engine components are named after their engine: `KekulePeriodicTable.client.vue` → `<ChemKekulePeriodicTable>`. Domain-generic names (`ChemPeriodicTable`, …) stay reserved for custom or other-engine components — the library intentionally offers multiple engines per purpose, users choose freely. |
| Engine import | `kekule` in `dependencies`; loaded via dynamic `import('kekule')` inside client-only components → lazy chunk (~600 KB gz; Kekule dist chunks are side-effect global scripts, so no tree-shaking). Never `require('kekule')` — the CJS entry has a bare `__filename` bug (upstream issue #308). |
| Theme CSS | `import('kekule/theme')` alongside the engine — single self-contained 175 KB stylesheet (all icons inline as data URIs), lazy-loads with the same chunk. |
| SSR | `.client.vue` suffix (AGENTS.md option 1). No server markup, no hydration mismatch. In-component Tailwind loading placeholder while `!ready`. |
| Modernization vs Kekule-Vue | `<script setup lang="ts">`, typed props/emits, `defineModel`, `defineExpose`; explicit per-widget prop sync instead of runtime reflection over all widget properties; real ESM import instead of the `window.Kekule` global; explicit `addEventListener` instead of monkey-patching `BaseWidget.dispatchEvent`. |
| Composable | `useChemKekuleWidget()` (auto-imported) is the modern replacement for `KekuleVue.Utils.wrapWidget()` and the shared foundation for all three components (and any future Kekule widget). |

## Project 1 — Shared foundation + `ChemKekulePeriodicTable`

Goal: everything engine-generic (dependency, module wiring, types, loader, composable) plus the
first widget, the periodic table.

1. **Dependency:** `pnpm add kekule` (runtime `dependencies`).
2. **`src/module.ts`:** in the existing `vite:extendConfig` hook, add `'kekule'` to
   `optimizeDeps.include` for the client config (dev pre-bundling). No new module options.
3. **`src/runtime/utils/kekule/types.ts`** — minimal structural types, internal only, no ambient
   globals: `KekuleNamespace` (loose `ChemWidget` / `Editor` / `IO` / `Render` shapes),
   `KekuleWidget` (`setPropValue`, `getPropValue`, `appendToElem`, `finalize`, `addEventListener`,
   `removeEventListener`), `KekuleEventParam`.
4. **`src/runtime/utils/kekule/loadKekule.ts`** — cached loader:

   ```ts
   let promise: Promise<KekuleNamespace> | undefined
   export function loadKekule(inject?: () => Promise<KekuleNamespace>) {
     promise ||= inject ?? (async () => {
       const [mod] = await Promise.all([import('kekule'), import('kekule/theme')])
       return mod.Kekule
     })()
     return promise
   }
   ```

   (`inject` keeps it unit-testable; the module-level cache means all widgets share one load.)
5. **`src/runtime/composables/useChemKekuleWidget.ts`**:

   ```ts
   interface UseChemKekuleWidgetOptions<W extends KekuleWidget> {
     container: Ref<HTMLElement | undefined>
     create: (Kekule: KekuleNamespace) => W
     init?: (widget: W) => void                                  // apply initial prop values once
     watchers?: Array<{ source: WatchSource, apply: (widget: W, value: any) => void }>
     listeners?: Array<{ eventName: string, handler: (event: KekuleEventParam) => void }>
   }
   export function useChemKekuleWidget<W>(options): {
     widget: ShallowRef<W | undefined>; ready: Ref<boolean>; error: Ref<unknown>
   }
   ```

   - `onMounted`: `loadKekule()` → `create()` → `appendToElem(container.value)` → `init()` →
     attach `listeners` → `ready = true`. Failure lands in `error` (components render it).
   - `onBeforeUnmount`: `widget.finalize()`.
   - Re-entrancy guard flag around every prop application — the modern equivalent of
     Kekule-Vue's `__propModifiedByVueComponent__` — so widget-originated events that read state
     back into the model don't loop model → widget → model.
   - Header comment: derived from Kekule-Vue `src/kekule.vue.wrap.js` (MIT).
6. **`src/runtime/components/KekulePeriodicTable.client.vue`** → `<ChemKekulePeriodicTable>`:

   | API | Detail |
   | --- | --- |
   | `v-model` | `defineModel<string[]>()` — selected element symbols, two-way. Widget → model on `select`/`deselect` via `getSelectedSymbols()` (guarded); model → widget via `selectSymbols(value)`. |
   | Props | `useMiniMode?: boolean`, `enableMultiSelect?: boolean` (default `true`), `displayedComponents?: Array<'symbol'\|'name'\|'atomicNumber'\|'atomicWeight'\|'groupHead'\|'periodHead'\|'legend'>` |
   | Emits | `select` / `deselect` with the event's `elemData` payload (element record incl. symbol) |
   | Expose | `getWidget(): KekuleWidget` |

   Widget class: `Kekule.ChemWidget.PeriodicTable`; event names are exactly `select` /
   `deselect`, param shape `{ elemData }`. Wrapper div replicates Kekule-Vue's wrapper CSS with
   Tailwind: `inline-flex` container, widget child at 100% width/height; loading placeholder
   while `!ready`.
7. **Tests** (mirror paths; `vi.mock('kekule', …)` + `vi.mock('kekule/theme', …)` with a fake
   namespace + recording widget class, or the loader's `inject`):
   - `test/utils/kekule/loadKekule.test.ts` — caching + injection.
   - `test/composables/useChemKekuleWidget.test.ts` — host component + `mountSuspended`; assert
     lifecycle `create → appendToElem → init → listeners → finalize` on unmount, watcher
     application, loop guard.
   - `test/components/KekulePeriodicTable.test.ts` — container renders, model syncs on fake
     `select`, props applied, `getWidget` exposed.
8. **Playground:** create `playground/app/pages/kekule.vue` — section 1: two-way periodic table
   (selected symbols listed, mini-mode / multi-select toggles). Add a nav card on `index.vue`.
9. **Gate:** `pnpm dev:prepare && pnpm lint && pnpm typecheck && pnpm test && pnpm build:playground`.

## Project 2 — `ChemKekuleViewer` + display-type util

Goal: 2D molecule display. Adds the viewer-specific util `displayType`.

1. **`src/runtime/utils/kekule/displayType.ts`** + `test/utils/kekule/displayType.test.ts`:
   `resolveMoleculeDisplayType(kekule, name)` maps `'skeletal' | 'condensed' | 'wire' | 'sticks'
   | 'ball-stick' | 'space-fill'` → numeric `Kekule.Render.Molecule2DDisplayType` /
   `Molecule3DDisplayType` enum values (upstream props are numeric enums — strings are our
   friendlier API). Throws on unknown names. Pure given the namespace argument → testable with a
   stub `{ Render: { Molecule2DDisplayType: { SKELETAL: 1, … } } }`.
2. **`src/runtime/components/KekuleViewer.client.vue`** → `<ChemKekuleViewer>`:

   | API | Detail |
   | --- | --- |
   | Props | `data?: string` + `format?: string` (default `'mol'`; upstream readers: `cml`, `mol`/`mol3k`, `rxn`, `sd`, `json`/`kcj`/`kcx` — **no SMILES reader upstream**); `predefinedSetting?: 'basic'\|'fullFunc'\|'mini'\|'static'` (default `'basic'`); `moleculeDisplayType?: MoleculeDisplayTypeName` (default `'skeletal'`); `hideHydrogens?: boolean` |
   | Emits | `ready`, `editing-done` (Viewer's `editingDone` `{ obj }`) |
   | Expose | `getWidget()`, `exportData(format: string): string` via `Kekule.IO.saveFormatData` (supports `'mol' \| 'cml' \| 'smi' \| 'kcj'`) |

   - Widget class: `Kekule.ChemWidget.Viewer`. Load path: set the widget's `chemObjData` prop
     (`JSON.stringify({ format, data })`) — its setter runs `loadFormatData` internally and can
     auto-generate 2D coordinates (`autoGenerateCoordsAfterLoad`) for MOL data without coords.
     Watch `data`/`format` → re-set.
   - Apply `predefinedSetting` **before** other props (it presets toolbars/interaction).
   - Default height: `min-h-[16rem]` on the container; consumers size via `class`.
3. **Tests:** `test/components/KekuleViewer.test.ts` — mocked kekule; assert `chemObjData` set
   from props, display-type resolution applied as numeric enum, predefinedSetting ordering,
   `exportData` plumbing.
4. **Playground:** append viewer section to `pages/kekule.vue` — hardcoded caffeine MOL string,
   display-type toggle buttons, hide-hydrogens switch.
5. **Gate:** as Project 1.

## Project 3 — `ChemKekuleComposer` (structure editor)

Goal: 2D structure editor (upstream class `Kekule.Editor.Composer`; file named `Composer` to
mirror upstream, matching Kekule-Vue's component name).

1. **`src/runtime/components/KekuleComposer.client.vue`** → `<ChemKekuleComposer>`:

   | API | Detail |
   | --- | --- |
   | Props | `predefinedSetting?: 'compact'\|'molOnly'\|'fullFunc'` (default `'compact'`), `enableOperHistory?: boolean` |
   | `v-model` | `defineModel<object>()` — the chem document object from `getSavingTargetObj()`, updated on `userModificationDone`. **Raw Kekule object**, same semantics as Kekule-Vue's default model; documented as such (serialize via `exportData()`). |
   | Emits | `update` (`userModificationDone`), `load` (`load` `{ obj }`) |
   | Expose | `getWidget()`, `loadData(data: string, format: string)` (wraps `loadFromData`), `exportData(format: string): string` |

   - `predefinedSetting` applied before other props; guard flag around model writes.
   - Default height `min-h-[24rem]`.
2. **Tests:** `test/components/KekuleComposer.test.ts` — mocked kekule; model updates on
   `userModificationDone` via `getSavingTargetObj`, `loadData`/`exportData` plumbing.
3. **Playground:** append editor section to `pages/kekule.vue` — editor + "Export MOL" button
   filling a `<textarea>` via `exportData('mol')`.
4. **Gate:** as Project 1.

## Wrap-up (after Project 3)

- README Status list: `<ChemKekulePeriodicTable>`, `<ChemKekuleViewer>`, `<ChemKekuleComposer>`,
  `useChemKekuleWidget()`.
- README "Bundled engines" note: `kekule` ships as a dependency, loads as a lazy client chunk;
  no SMILES *input* (writer only); 3D render modes require a global `three.js` (`window.THREE`)
  and are out of scope for now — 2D only.

## Upstream gotchas reference

- **Widget constructors take the target document**: `new Kekule.ChemWidget.PeriodicTable(el.ownerDocument)`
  — without it the widget never creates its root element and `appendToElem` dies with
  `appendChild: parameter 1 is not of type 'Node'` (discovered live in Project 1; the composable's
  `create(Kekule, container)` factory passes the container for this). Applies to Viewer/Composer too.
- Import `'kekule'` (or `'kekule/mod/chemWidget'`); there is **no** `'kekule/mod/chemEditor'` —
  `Kekule.Editor.Composer` lives in the `chemWidget` module. The plain `'kekule'` entry is
  simplest.
- `kekule` ships no TS declarations — `src/runtime/utils/kekule/kekule-module.d.ts` shims
  `'kekule'` / `'kekule/theme'` so the dynamic import typechecks.
- Kekule dist chunks are plain side-effect scripts sharing a `globalThis.Kekule` free variable —
  import order matters (handled by their ESM shims), tree-shaking is impossible, and import time
  is SSR-safe; only widget *instantiation* needs a DOM (hence `.client.vue`).
- Avoid the CJS entry under bundlers (bare `__filename` → `Invalid URL`, issue #308).
- Kekule display-type props are numeric enums, not strings — hence `displayType.ts` (Project 2).
- PeriodicTable multi-select prop is `enableMultiSelect`; events `select`/`deselect` carry a
  single `{ elemData }` field. Programmatic selection (`selectedSymbols` prop /
  `selectSymbols()`) fires those same events synchronously — the composable's re-entrancy guard
  (flag up during apply, cleared on `nextTick`) suppresses the echo; guarded handlers skip both
  the model write-back and the re-emit. Verified live plus in tests.
- Viewer `predefinedSetting` presets: `basic` (save/display-type/zoom toolbar), `fullFunc`
  (toolbar + editing), `mini` (menu button), `static` (no toolbar/interaction).
- Composer events of interest: `userModificationDone` (no params), `load` `{ obj }`,
  `editObjsUpdated`; `getChemObj()` returns the ChemDocument root — use `getSavingTargetObj()`
  for the model value.
- **`loadFromData` argument order** (discovered live in Project 3): upstream signature is
  `(data, dataType, mimeType, formatId, coordMode)` — the format id is the **4th** argument.
  Passing it 2nd "works" (the `load` event even fires with a parsed obj) but the editor document
  stays empty: `getSavingTargetObj()` and `exportData()` come back empty. The wrapper's
  `loadData(data, format)` must call `loadFromData(data, undefined, undefined, format)`.
- Composer `enableOperHistory` upstream default is `true`
  (`Kekule.globalOptions` → `chemWidget.editor.enableOperHistory`). Vue casts an absent Boolean
  prop to `false`, so the wrapper's prop carries an explicit `@default true` instead of deferring
  to the engine default.
- Switching `predefinedSetting` **live** (after mount) does rebuild the toolbar, but the exact
  button inventory can differ from a fresh mount at the same preset (Kekule merges some prior
  toolbar state). Verified live in Project 3: prop value round-trips correctly either way;
  prefer setting the preset at mount when the exact toolbar matters.
- Teardown: always `widget.finalize()` on unmount (the composable does this).
