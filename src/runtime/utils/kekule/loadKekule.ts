import type { KekuleNamespace } from './types'

/**
 * Cached loader for the Kekule engine and its theme stylesheet.
 *
 * The module-level cache means every widget component in the app shares a
 * single load: the engine (~600 KB gz as a lazy chunk) and its self-contained
 * theme CSS are fetched once, no matter how many widgets mount.
 *
 * `inject` exists for unit tests, which pass a fake namespace instead of the
 * real 2.6 MB dist chain. The first call wins — later `inject`s are ignored.
 */
let promise: Promise<KekuleNamespace> | undefined

export function loadKekule(inject?: () => Promise<KekuleNamespace>): Promise<KekuleNamespace> {
  promise ||= inject
    ? inject()
    : (async () => {
        // Always the ESM entry, never require('kekule') — the CJS shim has a
        // bare __filename bug under bundlers (kekule issue #308).
        // 'kekule/theme' is the single self-contained theme stylesheet; it
        // lazy-loads with the same chunk.
        const [mod] = await Promise.all([import('kekule'), import('kekule/theme')])
        return mod.Kekule as KekuleNamespace
      })()
  return promise
}
