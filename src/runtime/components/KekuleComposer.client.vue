<script setup lang="ts">
// Widget-wiring pattern derived from Kekule-Vue's composer wrapper
// (https://github.com/partridgejiang/Kekule-Vue — src/kekule.vue.wrap.js +
// src/kekule.vue.components.js, MIT, © 2022 partridgejiang): v-model mirrors
// the widget's saving target object (`getSavingTargetObj()`), refreshed on
// `userModificationDone`/`load`; Kekule-Vue's `getSavingTargetObj` trick
// avoids handing consumers the ChemDocument root. The Kekule engine and theme
// are lazy-loaded client-side; this file never renders on the server
// (`.client.vue`).
import { ref } from 'vue'
import { useChemKekuleWidget } from '../composables/useChemKekuleWidget'
import type {
  KekuleComposerLoadEventParam,
  KekuleComposerWidget,
  KekuleEventParam,
  KekuleNamespace,
} from '../utils/kekule/types'

/** Capability/toolbar presets `Editor.Composer` ships (`predefinedSetting`). */
type ComposerPredefinedSetting = 'compact' | 'molOnly' | 'fullFunc'

const props = withDefaults(defineProps<{
  /**
   * Capability/toolbar preset. Applied before every other prop — presets
   * configure toolbars and interactions the other props build on.
   * @default 'compact'
   */
  predefinedSetting?: ComposerPredefinedSetting
  /**
   * Undo/redo operation history. The default matches Kekule's own
   * (`chemWidget.editor.enableOperHistory`) — Vue casts an absent Boolean
   * prop to `false`, so deferring to the engine default isn't expressible.
   * @default true
   */
  enableOperHistory?: boolean
}>(), {
  predefinedSetting: 'compact',
  enableOperHistory: true,
})

/**
 * The edited chem document (raw Kekule object from `getSavingTargetObj()`),
 * updated by the widget — one-way widget→model. Serialize via `exportData()`,
 * load content via `loadData()`.
 */
const model = defineModel<object>()

const emit = defineEmits<{
  /** The user finished a modification gesture in the editor. */
  update: []
  /** Content was (re)loaded into the editor (e.g. via `loadData`). */
  load: [obj: unknown]
}>()

const container = ref<HTMLElement>()

// Captured during `create` so `exportData` can serialize synchronously.
let kekule: KekuleNamespace | undefined

const { widget, ready, error, isApplying } = useChemKekuleWidget<KekuleComposerWidget>({
  container,
  create: (namespace, element) => {
    kekule = namespace
    return new namespace.Editor.Composer(element.ownerDocument)
  },
  init(widget) {
    // Track container resizes (theme CSS pins the widget to 600x400; the
    // `!important` width override below frees it and the editor context
    // needs this to refit). No-op where ResizeObserver is unavailable.
    widget.setPropValue('observeElemResize', true)
    applyPredefinedSetting(widget, props.predefinedSetting)
  },
  watchers: [
    { source: () => props.predefinedSetting, apply: applyPredefinedSetting },
    { source: () => props.enableOperHistory, apply: (w, v) => applyOperHistory(w, v as boolean) },
  ],
  listeners: [
    { eventName: 'userModificationDone', handler: () => onModificationDone() },
    { eventName: 'load', handler: event => onLoad(event) },
  ],
})

function applyPredefinedSetting(widget: KekuleComposerWidget, value: unknown) {
  widget.setPropValue('predefinedSetting', value)
  // A preset change resets editor capabilities — re-assert the explicit
  // oper-history setting so it doesn't silently revert.
  applyOperHistory(widget, props.enableOperHistory)
}

function applyOperHistory(widget: KekuleComposerWidget, value: boolean) {
  widget.setPropValue('enableOperHistory', value)
}

function onModificationDone() {
  // Prop applications can echo `userModificationDone` (the guard suppresses
  // that echo); only real user modifications refresh the model here.
  if (isApplying()) {
    return
  }
  emit('update')
  model.value = widget.value?.getSavingTargetObj() as object | undefined
}

function onLoad(event: KekuleEventParam) {
  if (isApplying()) {
    return
  }
  emit('load', (event as KekuleComposerLoadEventParam).obj)
  // Loading replaces the saving target — keep the model from going stale.
  model.value = widget.value?.getSavingTargetObj() as object | undefined
}

defineExpose({
  /** The live Kekule widget instance (undefined until mounted). */
  getWidget: (): KekuleComposerWidget | undefined => widget.value,
  /** Replace editor content from serialized molecule data (e.g. MOL, CML). */
  loadData: (data: string, format: string) => widget.value?.loadFromData(data, undefined, undefined, format),
  /**
   * Serialize the edited structure (`Kekule.IO.saveFormatData` — e.g. `'mol'`,
   * `'cml'`, `'smi'`, `'kcj'`). Throws while the engine is still loading.
   */
  exportData: (format: string): string => {
    const instance = widget.value
    if (!instance || !kekule?.IO) {
      throw new Error('ChemKekuleComposer is not ready yet (the Kekule engine is still loading).')
    }
    return kekule.IO.saveFormatData(instance.getSavingTargetObj(), format)
  },
})
</script>

<template>
  <div>
    <div
      v-if="error"
      class="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
      role="alert"
    >
      Failed to load the Kekule composer: {{ error }}
    </div>
    <template v-else>
      <div
        v-if="!ready"
        class="min-h-[24rem] w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800"
        role="status"
        aria-label="Loading structure editor"
      />
      <!-- Always in the DOM (hidden until ready): the widget mounts into it
           on component mount, before `ready` flips. -->
      <div
        v-show="ready"
        ref="container"
        class="flex min-h-[24rem] w-full flex-col [&>*]:w-full! [&>*]:flex-auto"
      />
    </template>
  </div>
</template>
