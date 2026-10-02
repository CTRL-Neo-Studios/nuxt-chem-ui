import {
  addComponentsDir,
  addImportsDir,
  createResolver,
  defineNuxtModule,
} from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import tailwindcss from '@tailwindcss/vite'

export interface ModuleOptions {
  /**
   * Inject the library's Tailwind CSS entry (`@import "tailwindcss"` plus
   * `@source` scanning of the library's own components).
   * Set to `false` when the consuming app already sets up Tailwind CSS v4
   * itself; in that case add `@source "../node_modules/nuxt-chem-ui";`
   * to the app's own CSS so the library's utility classes are generated.
   * @default true
   */
  css?: boolean
}

// Explicit annotation keeps the emitted declaration portable under pnpm's
// isolated node_modules layout (avoids TS2742 on @nuxt/schema references).
const module: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-chem-ui',
    configKey: 'chemUi',
    compatibility: {
      nuxt: '>=3.13.0',
    },
  },
  defaults: {
    css: true,
  },
  setup(options, nuxt) {
    const { resolve } = createResolver(import.meta.url)

    // Components in src/runtime/components are auto-registered with the
    // `Chem` prefix: MolecularFormula.vue -> <ChemMolecularFormula>
    addComponentsDir({
      path: resolve('./runtime/components'),
      prefix: 'Chem',
      pathPrefix: false,
    })

    // Composables in src/runtime/composables are auto-imported (useChem*)
    addImportsDir(resolve('./runtime/composables'))

    if (options.css) {
      nuxt.options.css.push(resolve('./runtime/css/main.css'))
    }

    // Register the Tailwind CSS v4 Vite plugin unless the app already has it,
    // so consuming apps get Tailwind without any setup of their own.
    nuxt.hook('vite:extendConfig', (config) => {
      const writable = config as { plugins?: Array<unknown> }
      const plugins = (writable.plugins ||= [])
      const hasTailwind = plugins.flat(Infinity).some(plugin =>
        typeof plugin === 'object'
        && plugin !== null
        && (plugin as { name?: string }).name === '@tailwindcss/vite',
      )
      if (!hasTailwind) {
        plugins.push(tailwindcss())
      }
    })
  },
})

export default module
