import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import KekuleComposer from '../../src/runtime/components/KekuleComposer.client.vue'
import { loadKekule } from '../../src/runtime/utils/kekule/loadKekule'
import type { KekuleComposerWidget, KekuleEventParam, KekuleNamespace } from '../../src/runtime/utils/kekule/types'

vi.mock('../../src/runtime/utils/kekule/loadKekule', () => ({
  loadKekule: vi.fn(),
}))

const saveFormatData = vi.fn((obj: unknown, formatId: string) => `serialized:${formatId}`)

/**
 * Fake of `Kekule.Editor.Composer` mimicking the behaviors the component
 * relies on: applying a `predefinedSetting` reconfigures the editor and fires
 * an internal `userModificationDone`; loading data replaces the saving
 * target and fires `load`.
 */
class FakeComposer implements KekuleComposerWidget {
  static instances: FakeComposer[] = []

  static reset() {
    FakeComposer.instances = []
  }

  setPropValueCalls: Array<[string, unknown]> = []
  element = document.createElement('div')
  appendedTo: HTMLElement | undefined
  finalized = false
  savingTarget: object = { fake: 'chemDocument' }
  loadFromDataCalls: Array<[string, string | undefined]> = []
  private listeners = new Map<string, Array<(event: KekuleEventParam) => void>>()

  constructor() {
    FakeComposer.instances.push(this)
  }

  setPropValue(propName: string, value: unknown): void {
    this.setPropValueCalls.push([propName, value])
    // Applying a preset reconfigures the editor, which fires an internal
    // modification event — the echo the wrapper's guard must suppress.
    if (propName === 'predefinedSetting') {
      this.dispatch('userModificationDone', {})
    }
  }

  getPropValue(_propName: string): unknown {
    return undefined
  }

  appendToElem(el: HTMLElement): unknown {
    this.appendedTo = el
    return el.appendChild(this.element)
  }

  finalize(): void {
    this.finalized = true
  }

  addEventListener(eventName: string, handler: (event: KekuleEventParam) => void): unknown {
    const list = this.listeners.get(eventName) ?? []
    list.push(handler)
    this.listeners.set(eventName, list)
    return this
  }

  removeEventListener(eventName: string, handler: (event: KekuleEventParam) => void): unknown {
    const list = this.listeners.get(eventName) ?? []
    const index = list.indexOf(handler)
    if (index >= 0) {
      list.splice(index, 1)
    }
    return this
  }

  getChemObj(): unknown {
    return { fake: 'chemDocumentRoot' }
  }

  getSavingTargetObj(): unknown {
    return this.savingTarget
  }

  loadFromData(data: string, _dataType?: unknown, _mimeType?: unknown, formatId?: string, _coordMode?: unknown): unknown {
    this.loadFromDataCalls.push([data, formatId])
    this.savingTarget = { fake: `loaded-${formatId}` }
    this.dispatch('load', { obj: this.savingTarget })
    return undefined
  }

  /** Simulate the user editing a bond or atom in the canvas. */
  editByUser(): void {
    this.savingTarget = { fake: 'edited' }
    this.dispatch('userModificationDone', {})
  }

  private dispatch(eventName: string, param: KekuleEventParam): void {
    for (const handler of [...this.listeners.get(eventName) ?? []]) {
      handler(param)
    }
  }
}

const fakeNamespace = { ChemWidget: {}, Editor: { Composer: FakeComposer }, IO: { saveFormatData } } as unknown as KekuleNamespace

function mockLoad() {
  vi.mocked(loadKekule).mockReset().mockResolvedValue(fakeNamespace)
}

async function mountComposer(props: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(KekuleComposer, { props })
  await flushPromises()
  await nextTick()
  return wrapper
}

describe('ChemKekuleComposer', () => {
  beforeEach(() => {
    FakeComposer.reset()
    saveFormatData.mockClear()
    mockLoad()
  })

  it('mounts the widget into its container and applies the preset before other props', async () => {
    const wrapper = await mountComposer({
      modelValue: {},
      predefinedSetting: 'molOnly',
      enableOperHistory: true,
    })
    const instance = FakeComposer.instances.at(-1)!

    expect(instance.appendedTo).toBeTruthy()
    expect(instance.appendedTo!.contains(instance.element)).toBe(true)
    expect(instance.setPropValueCalls).toEqual([
      ['observeElemResize', true],
      ['predefinedSetting', 'molOnly'],
      ['enableOperHistory', true],
    ])
    // loading placeholder is gone once ready
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('applies the default preset and the default oper history', async () => {
    const wrapper = await mountComposer()
    const instance = FakeComposer.instances.at(-1)!

    expect(instance.setPropValueCalls).toEqual([
      ['observeElemResize', true],
      ['predefinedSetting', 'compact'],
      ['enableOperHistory', true],
    ])
    wrapper.unmount()
  })

  it('updates the model and emits update when the user modifies the structure', async () => {
    const wrapper = await mountComposer({ modelValue: {} })
    const instance = FakeComposer.instances.at(-1)!

    instance.editByUser()
    await nextTick()

    expect(wrapper.emitted('update')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toEqual([[{ fake: 'edited' }]])
    wrapper.unmount()
  })

  it('re-asserts enableOperHistory after a preset change and suppresses the modification echo', async () => {
    const wrapper = await mountComposer({ modelValue: {}, enableOperHistory: true })
    const instance = FakeComposer.instances.at(-1)!

    await wrapper.setProps({ predefinedSetting: 'fullFunc' })

    // The preset is applied first, the oper-history setting re-asserted after.
    expect(instance.setPropValueCalls.slice(-2)).toEqual([
      ['predefinedSetting', 'fullFunc'],
      ['enableOperHistory', true],
    ])
    // The userModificationDone echo fired by the preset application stays
    // internal (guard): neither a re-emit nor a model write.
    expect(wrapper.emitted('update')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    // The guard is up for one tick after a programmatic application; a user
    // modification after that is a genuine event again.
    await nextTick()
    instance.editByUser()
    await nextTick()
    expect(wrapper.emitted('update')).toHaveLength(1)
    wrapper.unmount()
  })

  it('pushes enableOperHistory changes to the live widget', async () => {
    const wrapper = await mountComposer()
    const instance = FakeComposer.instances.at(-1)!

    await wrapper.setProps({ enableOperHistory: false })
    expect(instance.setPropValueCalls).toContainEqual(['enableOperHistory', false])
    wrapper.unmount()
  })

  it('loads data through the exposed loadData, re-emitting load and refreshing the model', async () => {
    const wrapper = await mountComposer({ modelValue: {} })
    const instance = FakeComposer.instances.at(-1)!

    wrapper.vm.loadData('mol-data', 'mol')
    await nextTick()

    expect(instance.loadFromDataCalls).toEqual([['mol-data', 'mol']])
    expect(wrapper.emitted('load')).toEqual([[{ fake: 'loaded-mol' }]])
    expect(wrapper.emitted('update:modelValue')).toEqual([[{ fake: 'loaded-mol' }]])
    wrapper.unmount()
  })

  it('serializes the saving target through Kekule.IO in exportData', async () => {
    const wrapper = await mountComposer()
    const instance = FakeComposer.instances.at(-1)!

    expect(wrapper.vm.exportData('mol')).toBe('serialized:mol')
    expect(saveFormatData).toHaveBeenCalledWith(instance.getSavingTargetObj(), 'mol')
    wrapper.unmount()
  })

  it('exposes the live widget via getWidget and finalizes on unmount', async () => {
    const wrapper = await mountComposer()
    const instance = FakeComposer.instances.at(-1)!

    expect(wrapper.vm.getWidget()).toBe(instance)
    wrapper.unmount()
    expect(instance.finalized).toBe(true)
  })

  it('renders an error panel when the engine fails to load', async () => {
    vi.mocked(loadKekule).mockReset().mockRejectedValue(new Error('boom'))
    const wrapper = await mountComposer()

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('boom')
    expect(FakeComposer.instances).toHaveLength(0)
    expect(() => wrapper.vm.exportData('mol')).toThrow(/not ready/)
    wrapper.unmount()
  })
})
