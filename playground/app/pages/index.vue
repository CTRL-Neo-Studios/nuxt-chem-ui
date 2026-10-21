<script setup lang="ts">
const examples = [
  { formula: 'H2O', name: 'Water' },
  { formula: 'CO2', name: 'Carbon dioxide' },
  { formula: 'C6H12O6', name: 'Glucose' },
  { formula: 'CuSO4·5H2O', name: 'Copper(II) sulfate pentahydrate' },
  { formula: 'C8H10N4O2', name: 'Caffeine' },
]

const input = ref('C8H10N4O2')
</script>

<template>
  <main class="mx-auto max-w-2xl px-6 py-16">
    <h1 class="text-3xl font-bold tracking-tight">
      nuxt-chem-ui playground
    </h1>
    <p class="mt-2 text-gray-600 dark:text-gray-400">
      Development playground for the chemistry UI components.
    </p>

    <NuxtLink
      to="/kekule"
      class="mt-6 flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-400 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-blue-600"
    >
      <span>
        <span class="font-medium">Kekule components</span>
        <span class="mt-0.5 block text-sm text-gray-600 dark:text-gray-400">
          Periodic table and structure editor powered by the Kekule.js engine — viewer coming.
        </span>
      </span>
      <span aria-hidden="true" class="text-gray-400">→</span>
    </NuxtLink>

    <section class="mt-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 class="text-lg font-semibold">
        ChemMolecularFormula
      </h2>
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
        Renders a molecular formula string with proper subscripts.
      </p>

      <ul class="mt-4 space-y-2">
        <li v-for="example in examples" :key="example.formula" class="flex items-baseline gap-3">
          <span class="text-2xl">
            <ChemMolecularFormula :formula="example.formula" />
          </span>
          <span class="text-sm text-gray-500 dark:text-gray-400">{{ example.name }}</span>
        </li>
      </ul>

      <div class="mt-6 border-t border-gray-200 pt-4 dark:border-gray-800">
        <label class="text-sm font-medium" for="formula-input">Try your own</label>
        <div class="mt-2 flex items-center gap-4">
          <input
            id="formula-input"
            v-model="input"
            class="w-48 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-mono text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
            placeholder="e.g. H2SO4"
          >
          <span class="text-xl">
            <ChemMolecularFormula :formula="input" />
          </span>
        </div>
      </div>
    </section>
  </main>
</template>
