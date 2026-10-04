<script setup lang="ts">
const selected = ref<string[]>(['C', 'H', 'O'])
const useMiniMode = ref(false)
const enableMultiSelect = ref(true)
const lastEvent = ref<string>()

const displayedPresets = {
  default: ['symbol', 'name', 'atomicNumber', 'groupHead', 'legend'],
  compact: ['symbol', 'groupHead'],
  detailed: ['symbol', 'name', 'atomicNumber', 'atomicWeight', 'groupHead', 'periodHead', 'legend'],
} as const
// Inferred as the literal-union array the component's prop expects.
const displayedComponents = ref([...displayedPresets.default])

const nobleGases = ['He', 'Ne', 'Ar', 'Kr', 'Xe', 'Rn']

function onSelect(elemData: { symbol: string }) {
  lastEvent.value = `selected ${elemData.symbol}`
}

function onDeselect(elemData: { symbol: string }) {
  lastEvent.value = `deselected ${elemData.symbol}`
}
</script>

<template>
  <main class="mx-auto max-w-5xl px-6 py-16">
    <NuxtLink
      to="/"
      class="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
    >
      ← All components
    </NuxtLink>
    <h1 class="mt-4 text-3xl font-bold tracking-tight">
      Kekule components
    </h1>
    <p class="mt-2 text-gray-600 dark:text-gray-400">
      Widgets powered by the Kekule.js engine, lazy-loaded as a client-side chunk.
    </p>

    <section class="mt-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 class="text-lg font-semibold">
        ChemKekulePeriodicTable
      </h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Interactive periodic table with two-way element selection (<code>v-model</code> holds element symbols).
      </p>

      <div class="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <label class="flex items-center gap-2">
          <input v-model="useMiniMode" type="checkbox" class="accent-blue-600">
          Mini mode
        </label>
        <label class="flex items-center gap-2">
          <input v-model="enableMultiSelect" type="checkbox" class="accent-blue-600">
          Multi-select
        </label>
        <span class="flex items-center gap-2">
          Components:
          <button
            v-for="(preset, name) in displayedPresets"
            :key="name"
            class="rounded-md border border-gray-300 px-2 py-0.5 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            @click="displayedComponents = [...preset]"
          >
            {{ name }}
          </button>
        </span>
        <span class="flex items-center gap-2">
          Selection:
          <button
            class="rounded-md border border-gray-300 px-2 py-0.5 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            @click="selected = [...nobleGases]"
          >
            Noble gases
          </button>
          <button
            class="rounded-md border border-gray-300 px-2 py-0.5 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            @click="selected = []"
          >
            Clear
          </button>
        </span>
      </div>

      <div class="mt-6 overflow-x-auto">
        <ChemKekulePeriodicTable
          v-model="selected"
          :use-mini-mode="useMiniMode"
          :enable-multi-select="enableMultiSelect"
          :displayed-components="displayedComponents"
          @select="onSelect"
          @deselect="onDeselect"
        />
      </div>

      <div class="mt-6 border-t border-gray-200 pt-4 text-sm dark:border-gray-800">
        <p>
          <span class="font-medium">Selected ({{ selected.length }}):</span>
          <span v-if="selected.length" class="ml-2 font-mono">{{ selected.join(' · ') }}</span>
          <span v-else class="ml-2 text-gray-500 dark:text-gray-400">none — click cells to select</span>
        </p>
        <p v-if="lastEvent" class="mt-1 text-gray-500 dark:text-gray-400">
          Last event: {{ lastEvent }}
        </p>
      </div>
    </section>
  </main>
</template>
