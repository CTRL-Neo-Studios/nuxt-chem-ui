<script setup lang="ts">
// Widget-wiring pattern derived from Kekule-Vue's periodic-table wrapper
// (https://github.com/partridgejiang/Kekule-Vue — src/kekule.vue.wrap.js +
// src/kekule.vue.components.js, MIT, © 2022 partridgejiang): v-model mirrors
// the widget's `selectedSymbols` prop, refreshed on `select`/`deselect`.
// The Kekule engine and theme are lazy-loaded client-side; this file never
// renders on the server (`.client.vue`).
import { ref } from 'vue'
import { useChemKekuleWidget } from '../composables/useChemKekuleWidget'
import type {
  KekuleElementData,
  KekuleEventParam,
  KekulePeriodicTableEventParam,
  KekulePeriodicTableWidget,
} from '../utils/kekule/types'

/**
 * Parts of the table Kekule renders per cell / around the grid
 * (`ChemWidget.PeriodicTable` `displayedComponents` values).
 */
type DisplayedComponent
  = | 'symbol'
    | 'name'
    | 'atomicNumber'
    | 'atomicWeight'
    | 'groupHead'
    | 'periodHead'
    | 'legend'

const props = withDefaults(defineProps<{
  /** Compact variant: smaller cells, symbol only. */
  useMiniMode?: boolean
  /**
   * Allow selecting more than one element at once.
   * @default true
   */
  enableMultiSelect?: boolean
  /**
   * Parts of the table to render. Left unset, Kekule's own default applies
   * (symbol, name, atomicNumber, groupHead, legend).
   */
  // eslint-disable-next-line vue/require-default-prop -- intentionally no default: defer to Kekule's own rather than duplicate it here
  displayedComponents?: DisplayedComponent[]
}>(), {
  enableMultiSelect: true,
})

/** Selected element symbols, two-way bound (`v-model`). */
const model = defineModel<string[]>({ default: () => [] })

const emit = defineEmits<{
  /** An element cell was selected by the user (not by programmatic selection). */
  select: [elemData: KekuleElementData]
  /** An element cell was deselected by the user (not by programmatic deselection). */
  deselect: [elemData: KekuleElementData]
}>()

const container = ref<HTMLElement>()

const { widget, ready, error, isApplying } = useChemKekuleWidget<KekulePeriodicTableWidget>({
  container,
  create: (Kekule, element) => new Kekule.ChemWidget.PeriodicTable(element.ownerDocument),
  init(widget) {
    widget.setPropValue('enableMultiSelect', props.enableMultiSelect)
    if (props.useMiniMode !== undefined) {
      widget.setPropValue('useMiniMode', props.useMiniMode)
    }
    if (props.displayedComponents !== undefined) {
      widget.setPropValue('displayedComponents', props.displayedComponents)
    }
    if (model.value.length > 0) {
      widget.setPropValue('selectedSymbols', model.value)
    }
  },
  watchers: [
    { source: () => props.enableMultiSelect, apply: (w, v) => w.setPropValue('enableMultiSelect', v) },
    { source: () => props.useMiniMode, apply: (w, v) => w.setPropValue('useMiniMode', v) },
    { source: () => props.displayedComponents, apply: (w, v) => w.setPropValue('displayedComponents', v) },
    { source: model, apply: (w, v) => w.setPropValue('selectedSymbols', v) },
  ],
  listeners: [
    { eventName: 'select', handler: event => onSelectionEvent('select', event) },
    { eventName: 'deselect', handler: event => onSelectionEvent('deselect', event) },
  ],
})

function onSelectionEvent(name: 'select' | 'deselect', event: KekuleEventParam) {
  // Programmatic selection (model → widget) fires the same events; the guard
  // keeps that echo from re-emitting to the consumer and looping back into
  // the model.
  if (isApplying()) {
    return
  }
  const elemData = (event as KekulePeriodicTableEventParam).elemData
  if (name === 'select') {
    emit('select', elemData)
  }
  else {
    emit('deselect', elemData)
  }
  model.value = widget.value?.getSelectedSymbols() ?? []
}

defineExpose({
  /** The live Kekule widget instance (undefined until mounted). */
  getWidget: (): KekulePeriodicTableWidget | undefined => widget.value,
})
</script>

<template>
  <div>
    <div
      v-if="error"
      class="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      role="alert"
    >
      Failed to load the Kekule periodic table: {{ error }}
    </div>
    <template v-else>
      <div
        v-if="!ready"
        class="h-64 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800"
        role="status"
        aria-label="Loading periodic table"
      />
      <!-- Always in the DOM (hidden until ready): the widget mounts into it
           on component mount, before `ready` flips. -->
      <div
        v-show="ready"
        ref="container"
        class="inline-flex [&>*]:h-full [&>*]:w-full [&>*]:flex-auto"
      />
    </template>
  </div>
</template>
