import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import KekulePeriodicTable from '../../src/runtime/components/KekulePeriodicTable.client.vue'
import { loadKekule } from '../../src/runtime/utils/kekule/loadKekule'
import type { KekuleElementData, KekuleEventParam, KekuleNamespace, KekulePeriodicTableWidget } from '../../src/runtime/utils/kekule/types'

vi.mock('../../src/runtime/utils/kekule/loadKekule', () => ({
  loadKekule: vi.fn(),
}))

/**
 * Fake of `Kekule.ChemWidget.PeriodicTable` mimicking the behaviors the
 * component relies on: `selectedSymbols` prop delegates to `selectSymbols()`
 * which replaces the selection and fires `select`/`deselect` events — for
 * programmatic selection just like for user clicks.
 */
class FakePeriodicTable implements KekulePeriodicTableWidget {
  static instances: FakePeriodicTable[] = []

  static reset() {
    FakePeriodicTable.instances = []
  }

  setPropValueCalls: Array<[string, unknown]> = []
  element = document.createElement('table')
  appendedTo: HTMLElement | undefined
  finalized = false
  selection: string[] = []
  private listeners = new Map<string, Array<(event: KekuleEventParam) => void>>()

  constructor() {
    FakePeriodicTable.instances.push(this)
  }

  setPropValue(propName: string, value: unknown): void {
    this.setPropValueCalls.push([propName, value])
    if (propName === 'selectedSymbols') {
      this.selectSymbols(value as string[])
    }
  }

  getPropValue(propName: string): unknown {
    return propName === 'selectedSymbols' ? this.getSelectedSymbols() : undefined
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

  getSelectedSymbols(): string[] {
    return [...this.selection]
  }

  selectSymbols(symbols: string[]): void {
    for (const symbol of this.selection.filter(symbol => !symbols.includes(symbol))) {
      this.dispatch('deselect', { elemData: { symbol } satisfies KekuleElementData })
    }
    this.selection = [...symbols]
    for (const symbol of symbols) {
      this.dispatch('select', { elemData: { symbol } satisfies KekuleElementData })
    }
  }

  /** Simulate a user clicking an element cell (toggle selection). */
  clickElement(symbol: string): void {
    if (this.selection.includes(symbol)) {
      this.selection = this.selection.filter(entry => entry !== symbol)
      this.dispatch('deselect', { elemData: { symbol } satisfies KekuleElementData })
    }
    else {
      this.selection = [...this.selection, symbol]
      this.dispatch('select', { elemData: { symbol } satisfies KekuleElementData })
    }
  }

  private dispatch(eventName: string, param: KekuleEventParam): void {
    for (const handler of [...this.listeners.get(eventName) ?? []]) {
      handler(param)
    }
  }
}

const fakeNamespace = { ChemWidget: { PeriodicTable: FakePeriodicTable } } as unknown as KekuleNamespace

function mockLoad() {
  vi.mocked(loadKekule).mockReset().mockResolvedValue(fakeNamespace)
}

async function mountTable(props: Record<string, unknown> = {}) {
  const wrapper = await mountSuspended(KekulePeriodicTable, { props })
  await flushPromises()
  await nextTick()
  return wrapper
}

describe('ChemKekulePeriodicTable', () => {
  beforeEach(() => {
    FakePeriodicTable.reset()
    mockLoad()
  })

  it('mounts the widget into its container and applies initial props and selection', async () => {
    const wrapper = await mountTable({
      modelValue: ['Fe'],
      useMiniMode: true,
      enableMultiSelect: false,
      displayedComponents: ['symbol'],
    })
    const instance = FakePeriodicTable.instances.at(-1)!

    expect(instance.appendedTo).toBeTruthy()
    expect(instance.appendedTo!.contains(instance.element)).toBe(true)
    expect(instance.setPropValueCalls).toEqual([
      ['enableMultiSelect', false],
      ['useMiniMode', true],
      ['displayedComponents', ['symbol']],
      ['selectedSymbols', ['Fe']],
    ])
    expect(instance.selection).toEqual(['Fe'])
    // loading placeholder is gone once ready
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('syncs the model and re-emits when the user selects an element', async () => {
    const wrapper = await mountTable({ modelValue: ['Fe'] })
    const instance = FakePeriodicTable.instances.at(-1)!

    instance.clickElement('Cu')
    await nextTick()

    expect(wrapper.emitted('select')).toEqual([[{ symbol: 'Cu' }]])
    expect(wrapper.emitted('update:modelValue')).toEqual([[['Fe', 'Cu']]])
    wrapper.unmount()
  })

  it('emits deselect and clears the model when the user clicks a selected element', async () => {
    const wrapper = await mountTable({ modelValue: ['Fe'] })
    const instance = FakePeriodicTable.instances.at(-1)!

    instance.clickElement('Fe')
    await nextTick()

    expect(wrapper.emitted('deselect')).toEqual([[{ symbol: 'Fe' }]])
    expect(wrapper.emitted('update:modelValue')).toEqual([[[]]])
    wrapper.unmount()
  })

  it('does not re-emit select/deselect for programmatic model-driven selection', async () => {
    const wrapper = await mountTable()
    const instance = FakePeriodicTable.instances.at(-1)!

    // Replacing the selection via the model replaces it in the widget...
    await wrapper.setProps({ modelValue: ['H', 'He'] })
    expect(instance.selection).toEqual(['H', 'He'])
    // ...but the select/deselect events that fires stay internal (guard).
    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.emitted('deselect')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    // The guard is up for one tick after a programmatic application; a user
    // click after that is a genuine event again.
    await nextTick()
    instance.clickElement('Li')
    await nextTick()
    expect(wrapper.emitted('select')).toEqual([[{ symbol: 'Li' }]])
    wrapper.unmount()
  })

  it('pushes prop changes to the live widget', async () => {
    const wrapper = await mountTable({ useMiniMode: true })
    const instance = FakePeriodicTable.instances.at(-1)!

    await wrapper.setProps({ useMiniMode: false, enableMultiSelect: false, displayedComponents: ['symbol', 'legend'] })
    expect(instance.setPropValueCalls).toContainEqual(['useMiniMode', false])
    expect(instance.setPropValueCalls).toContainEqual(['enableMultiSelect', false])
    expect(instance.setPropValueCalls).toContainEqual(['displayedComponents', ['symbol', 'legend']])
    wrapper.unmount()
  })

  it('exposes the live widget via getWidget and finalizes on unmount', async () => {
    const wrapper = await mountTable()
    const instance = FakePeriodicTable.instances.at(-1)!

    expect(wrapper.vm.getWidget()).toBe(instance)
    wrapper.unmount()
    expect(instance.finalized).toBe(true)
  })

  it('renders an error panel when the engine fails to load', async () => {
    vi.mocked(loadKekule).mockReset().mockRejectedValue(new Error('boom'))
    const wrapper = await mountTable()

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('boom')
    expect(FakePeriodicTable.instances).toHaveLength(0)
    wrapper.unmount()
  })
})
