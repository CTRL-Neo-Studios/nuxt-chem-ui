import { describe, expect, it } from 'vitest'
import { parseMolecularFormula } from '../../src/runtime/utils/formula'

describe('parseMolecularFormula', () => {
  it('splits digit runs into subscript tokens', () => {
    expect(parseMolecularFormula('H2O')).toEqual([
      { text: 'H', subscript: false },
      { text: '2', subscript: true },
      { text: 'O', subscript: false },
    ])
  })

  it('keeps a leading stoichiometric coefficient at normal size', () => {
    const tokens = parseMolecularFormula('2H2O')
    expect(tokens[0]).toEqual({ text: '2', subscript: false })
    expect(tokens[1]).toEqual({ text: 'H', subscript: false })
    expect(tokens[2]).toEqual({ text: '2', subscript: true })
  })

  it('passes hydrate dots, parentheses and charges through unchanged', () => {
    const formula = 'CuSO4·5H2O'
    const text = parseMolecularFormula(formula).map(token => token.text).join('')
    expect(text).toBe(formula)
  })

  it('returns a single plain token for digit-free formulas', () => {
    expect(parseMolecularFormula('NaCl')).toEqual([
      { text: 'NaCl', subscript: false },
    ])
  })

  it('returns an empty token list for an empty formula', () => {
    expect(parseMolecularFormula('')).toEqual([])
  })
})
