import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MolecularFormula from '../../src/runtime/components/MolecularFormula.vue'

describe('ChemMolecularFormula', () => {
  it('renders digits after the first character as subscripts', async () => {
    const wrapper = await mountSuspended(MolecularFormula, {
      props: { formula: 'H2O' },
    })
    expect(wrapper.html()).toContain('H')
    expect(wrapper.html()).toContain('<sub')
    expect(wrapper.html()).toContain('2</sub>')
  })

  it('renders a leading coefficient at normal size', async () => {
    const wrapper = await mountSuspended(MolecularFormula, {
      props: { formula: '2H2O' },
    })
    const subs = wrapper.findAll('sub')
    expect(subs).toHaveLength(1)
    expect(subs[0]!.text()).toBe('2')
    expect(wrapper.text()).toBe('2H2O')
  })

  it('renders plain text for digit-free formulas', async () => {
    const wrapper = await mountSuspended(MolecularFormula, {
      props: { formula: 'NaCl' },
    })
    expect(wrapper.text()).toBe('NaCl')
    expect(wrapper.find('sub').exists()).toBe(false)
  })
})
