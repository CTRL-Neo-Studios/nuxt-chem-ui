import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, shallowRef } from 'vue'
import type { Ref, ShallowRef } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { useChemKekuleWidget } from '../../src/runtime/composables/useChemKekuleWidget'
import { loadKekule } from '../../src/runtime/utils/kekule/loadKekule'
import type { KekuleEventParam, KekuleNamespace, KekuleWidget } from '../../src/runtime/utils/kekule/types'

vi.mock('../../src/runtime/utils/kekule/loadKekule', () => ({
  loadKekule: vi.fn(),
}))

/**
 * Recording fake widget. `setPropValue` synchronously fires a `change` event,
 * mimicking Kekule widgets whose programmatic setters raise the same events
 * as user interaction. Both the instance and a class-level log record calls,
 * so tests can assert global create → append → init → listen ordering across
 * the host component and the widget.
 */
class FakeWidget implements KekuleWidget {
  static instances: FakeWidget[] = []
  static log: string[] = []

  static reset() {
    FakeWidget.instances = []
    FakeWidget.log = []
  }

  order: string[] = []
  props = new Map<string, unknown>()
  element = document.createElement('div')
  /** Document the widget was constructed with (Kekule widget API). */
  doc: Document | undefined
  appendedTo: HTMLElement | undefined
  finalized = false
  private listeners = new Map<string, Array<(event: KekuleEventParam) => void>>()

  constructor(doc?: Document) {
    this.doc = doc
    FakeWidget.instances.push(this)
  }

  private push(entry: string) {
    this.order.push(entry)
    FakeWidget.log.push(entry)
  }

  setPropValue(propName: string, value: unknown): void {
    this.push(`set:${propName}=${String(value)}`)
    this.props.set(propName, value)
    for (const handler of [...this.listeners.get('change') ?? []]) {
      handler({ source: 'setPropValue' })
    }
  }

  getPropValue(propName: string): unknown {
    return this.props.get(propName)
  }

  appendToElem(element: HTMLElement): unknown {
    this.push('append')
    this.appendedTo = element
    return element.appendChild(this.element)
  }

  finalize(): void {
    this.push('finalize')
    this.finalized = true
  }

  addEventListener(eventName: string, handler: (event: KekuleEventParam) => void): unknown {
    this.push(`listen:${eventName}`)
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

  dispatch(eventName: string, param: KekuleEventParam = {}): void {
    for (const handler of [...this.listeners.get(eventName) ?? []]) {
      handler(param)
    }
  }
}

const fakeNamespace = { ChemWidget: { PeriodicTable: FakeWidget } } as unknown as KekuleNamespace

function mockLoad(resolve: boolean) {
  const mock = vi.mocked(loadKekule)
  mock.mockReset()
  if (resolve) {
    mock.mockResolvedValue(fakeNamespace)
  }
  else {
    mock.mockRejectedValue(new Error('engine failed'))
  }
}

interface HostState {
  container: Ref<HTMLElement | undefined>
  model: Ref<string>
  applies: Array<{ value: unknown, guarded: boolean }>
  eventLog: string[]
  ready: Ref<boolean>
  error: Ref<unknown>
  isApplying: () => boolean
  widget: ShallowRef<FakeWidget | undefined>
}

function createHost(): { Host: ReturnType<typeof defineComponent>, state: HostState } {
  const state: HostState = {
    container: ref<HTMLElement>(),
    model: ref('initial'),
    applies: [],
    eventLog: [],
    ready: ref(false),
    error: ref<unknown>(undefined),
    isApplying: () => false,
    widget: shallowRef<FakeWidget>(),
  }

  const Host = defineComponent({
    setup() {
      const result = useChemKekuleWidget<FakeWidget>({
        container: state.container,
        create: (Kekule, element) => {
          expect(Kekule).toBe(fakeNamespace)
          expect(element).toBe(state.container.value)
          FakeWidget.log.push('create')
          return new FakeWidget(element.ownerDocument)
        },
        init: () => FakeWidget.log.push('init'),
        watchers: [{
          source: state.model,
          apply: (target, value) => {
            state.applies.push({ value, guarded: state.isApplying() })
            target.setPropValue('model', value)
          },
        }],
        listeners: [{
          eventName: 'change',
          handler: () => {
            state.eventLog.push(`change:applying=${state.isApplying()}`)
            // The write-back pattern every wrapper component uses.
            if (!state.isApplying()) {
              state.model.value = 'from-widget'
            }
          },
        }],
      })
      state.ready = result.ready
      state.error = result.error
      state.isApplying = result.isApplying
      state.widget = result.widget
    },
    render: () => h('div', { ref: state.container }),
  })

  return { Host, state }
}

describe('useChemKekuleWidget', () => {
  beforeEach(() => {
    FakeWidget.reset()
  })

  it('mounts with lifecycle order create → append → init → listeners, then ready', async () => {
    mockLoad(true)
    const { Host, state } = createHost()
    const wrapper = await mountSuspended(Host)
    await flushPromises()

    const instance = FakeWidget.instances.at(-1)!
    expect(FakeWidget.log).toEqual(['create', 'append', 'init', 'listen:change'])
    // The widget is constructed with the container's document.
    expect(instance.doc).toBe(wrapper.element.ownerDocument)
    expect(instance.appendedTo).toBe(wrapper.element)
    expect(state.ready.value).toBe(true)
    expect(state.error.value).toBeUndefined()
    wrapper.unmount()
  })

  it('finalizes the widget and detaches listeners on unmount', async () => {
    mockLoad(true)
    const { Host, state } = createHost()
    const wrapper = await mountSuspended(Host)
    await flushPromises()
    const instance = FakeWidget.instances.at(-1)!

    wrapper.unmount()
    expect(instance.finalized).toBe(true)
    expect(instance.order.at(-1)).toBe('finalize')

    // Events dispatched after teardown no longer reach the handler.
    const eventsBefore = state.eventLog.length
    instance.dispatch('change')
    expect(state.eventLog).toHaveLength(eventsBefore)
  })

  it('applies watcher values to the live widget under the guard', async () => {
    mockLoad(true)
    const { Host, state } = createHost()
    const wrapper = await mountSuspended(Host)
    await flushPromises()
    const instance = FakeWidget.instances.at(-1)!

    // Values unchanged since setup are init's job, not the watcher's.
    expect(instance.props.has('model')).toBe(false)

    state.model.value = 'updated'
    await nextTick()
    expect(state.applies).toEqual([{ value: 'updated', guarded: true }])
    expect(instance.props.get('model')).toBe('updated')
    wrapper.unmount()
  })

  it('guards against model → widget → model loops', async () => {
    mockLoad(true)
    const { Host, state } = createHost()
    const wrapper = await mountSuspended(Host)
    await flushPromises()
    const instance = FakeWidget.instances.at(-1)!

    // Widget-originated event (user interaction): the handler writes back to
    // the model, which re-applies to the widget; the echo event fired inside
    // that application must not re-trigger the handler (no infinite loop).
    instance.dispatch('change', { source: 'user' })
    await nextTick()
    expect(state.model.value).toBe('from-widget')
    expect(state.applies).toEqual([{ value: 'from-widget', guarded: true }])

    // Model-originated change: echo events fired synchronously from
    // setPropValue are swallowed by the guard — exactly one apply, and only
    // the genuine event ever saw applying=false.
    state.model.value = 'consumer-set'
    await nextTick()
    expect(state.applies.map(apply => apply.value)).toEqual(['from-widget', 'consumer-set'])
    expect(state.eventLog.filter(entry => entry === 'change:applying=false')).toHaveLength(1)
    wrapper.unmount()
  })

  it('captures load failures in error and never becomes ready', async () => {
    mockLoad(false)
    const { Host, state } = createHost()
    const wrapper = await mountSuspended(Host)
    await flushPromises()
    expect(state.ready.value).toBe(false)
    expect((state.error.value as Error).message).toBe('engine failed')
    wrapper.unmount()
  })
})
