import { describe, expect, it, vi } from 'vitest'
import type { KekuleNamespace } from '../../../src/runtime/utils/kekule/types'

const { fakeNamespace } = vi.hoisted(() => ({
  fakeNamespace: { ChemWidget: { PeriodicTable: {} } },
}))

vi.mock('kekule', () => ({ Kekule: fakeNamespace }))
vi.mock('kekule/theme', () => ({}))

// The loader caches its promise in module state; re-import for a fresh cache.
async function freshLoadKekule() {
  vi.resetModules()
  return await import('../../../src/runtime/utils/kekule/loadKekule')
}

describe('loadKekule', () => {
  it('resolves the namespace returned by the injected loader', async () => {
    const { loadKekule } = await freshLoadKekule()
    const injected = { ChemWidget: { PeriodicTable: {} } } as unknown as KekuleNamespace
    await expect(loadKekule(() => Promise.resolve(injected))).resolves.toBe(injected)
  })

  it('caches: repeated calls return the same promise and the first inject wins', async () => {
    const { loadKekule } = await freshLoadKekule()
    const first = {} as KekuleNamespace
    const second = {} as KekuleNamespace
    let injectCalls = 0
    const p1 = loadKekule(async () => {
      injectCalls++
      return first
    })
    const p2 = loadKekule(() => Promise.resolve(second))
    expect(p2).toBe(p1)
    await expect(p1).resolves.toBe(first)
    expect(injectCalls).toBe(1)
  })

  it('loads the real module path by default (kekule + kekule/theme)', async () => {
    const { loadKekule } = await freshLoadKekule()
    await expect(loadKekule()).resolves.toBe(fakeNamespace)
  })
})
