// Widget-wiring lifecycle derived from Kekule-Vue's generic wrapper
// (https://github.com/partridgejiang/Kekule-Vue — src/kekule.vue.wrap.js,
// MIT, © 2022 partridgejiang). Modernized: explicit listeners/watchers
// instead of runtime reflection over widget properties, real ESM import
// instead of the `window.Kekule` global, and a re-entrancy guard flag
// instead of monkey-patched `__propModifiedByVueComponent__`.
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { Ref, ShallowRef, WatchSource } from 'vue'
import { loadKekule } from '../utils/kekule/loadKekule'
import type { KekuleEventParam, KekuleNamespace, KekuleWidget } from '../utils/kekule/types'

export interface UseChemKekuleWidgetOptions<W extends KekuleWidget> {
  /** Template ref of the element the widget mounts into. */
  container: Ref<HTMLElement | undefined>
  /**
   * Widget factory. Receives the loaded Kekule namespace and the container
   * element — Kekule widget constructors need the container's document
   * (`new Kekule.ChemWidget.PeriodicTable(container.ownerDocument)`).
   */
  create: (Kekule: KekuleNamespace, container: HTMLElement) => W
  /** Runs once after the widget is appended — apply initial prop values here. */
  init?: (widget: W) => void
  /**
   * Model→widget sync. Each entry watches a Vue source and pushes new values
   * onto the widget. Values changing before the widget is ready are skipped
   * (cover them in `init` instead).
   */
  watchers?: Array<{
    source: WatchSource<unknown>
    apply: (widget: W, value: unknown) => void
  }>
  /**
   * Widget→Vue event bridge, attached after `init` so initial prop values
   * don't fire handlers.
   */
  listeners?: Array<{
    eventName: string
    handler: (event: KekuleEventParam) => void
  }>
}

/**
 * Mount and manage the lifecycle of a Kekule widget inside a client-only
 * component: load the (cached) engine, create the widget, append it, apply
 * initial values, bridge events, and `finalize()` on unmount.
 *
 * Widget methods that change state programmatically (e.g.
 * `PeriodicTable.selectSymbols`) fire the same events as user interaction.
 * To keep that echo from looping model → widget → model, every watcher
 * application runs under a re-entrancy guard: while it is in flight,
 * `isApplying()` returns `true` and event handlers should skip their
 * write-back into the model (and any re-emit).
 *
 * @returns `widget` (undefined until mounted), `ready`, `error` (set when the
 * load/create/mount sequence fails — render it in the template), and
 * `isApplying()` for the guard check in event handlers.
 */
export function useChemKekuleWidget<W extends KekuleWidget>(
  options: UseChemKekuleWidgetOptions<W>,
): {
  widget: ShallowRef<W | undefined>
  ready: Ref<boolean>
  error: Ref<unknown>
  isApplying: () => boolean
} {
  const widget = shallowRef<W>()
  const ready = ref(false)
  const error = ref<unknown>()

  let applying = false
  let disposed = false

  onMounted(async () => {
    try {
      const Kekule = await loadKekule()
      const instance = options.create(Kekule, options.container.value!)
      if (disposed) {
        instance.finalize()
        return
      }
      widget.value = instance
      instance.appendToElem(options.container.value!)
      options.init?.(instance)
      for (const { eventName, handler } of options.listeners ?? []) {
        instance.addEventListener(eventName, handler)
      }
      ready.value = true
    }
    catch (err) {
      error.value = err
    }
  })

  onBeforeUnmount(() => {
    disposed = true
    const instance = widget.value
    if (instance) {
      for (const { eventName, handler } of options.listeners ?? []) {
        instance.removeEventListener(eventName, handler)
      }
      instance.finalize()
      widget.value = undefined
    }
  })

  for (const { source, apply } of options.watchers ?? []) {
    watch(source, (value) => {
      const instance = widget.value
      if (!instance) {
        return
      }
      applying = true
      try {
        apply(instance, value)
      }
      finally {
        // Cleared after the flush: Kekule fires widget events synchronously
        // from inside apply(), and any watcher jobs queued in the same flush
        // must still see the guard up.
        void nextTick(() => {
          applying = false
        })
      }
    })
  }

  return {
    widget,
    ready,
    error,
    isApplying: () => applying,
  }
}
