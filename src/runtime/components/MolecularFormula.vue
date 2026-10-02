<script setup lang="ts">
import { computed } from 'vue'
import { parseMolecularFormula } from '../utils/formula'

const props = defineProps<{
  /** Molecular formula, e.g. `H2O`, `CuSO4·5H2O` */
  formula: string
}>()

const tokens = computed(() => parseMolecularFormula(props.formula))
</script>

<template>
  <span class="font-mono whitespace-nowrap">
    <template v-for="(token, index) in tokens" :key="index">
      <sub v-if="token.subscript" class="text-[0.7em]">{{ token.text }}</sub>
      <template v-else>{{ token.text }}</template>
    </template>
  </span>
</template>
