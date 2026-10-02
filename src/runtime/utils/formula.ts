export interface FormulaToken {
  /** Token text, e.g. `H`, `2`, or `·5` */
  text: string
  /**
   * Whether the token renders as a subscript. Digit runs after the first
   * character are treated as subscripts; a leading stoichiometric
   * coefficient (e.g. the `2` in `2H2O`) stays at normal size.
   */
  subscript: boolean
}

/**
 * Parse a molecular formula string into display tokens.
 *
 * Digit runs become subscript tokens; everything else (element symbols,
 * parentheses, hydrate dots, charges) passes through as plain text.
 *
 * @example
 * parseMolecularFormula('H2O')
 * // [{ text: 'H', subscript: false }, { text: '2', subscript: true }, { text: 'O', subscript: false }]
 */
export function parseMolecularFormula(formula: string): FormulaToken[] {
  const tokens: FormulaToken[] = []
  let cursor = 0

  for (const match of formula.matchAll(/\d+/g)) {
    const index = match.index ?? 0
    if (index > cursor) {
      tokens.push({ text: formula.slice(cursor, index), subscript: false })
    }
    tokens.push({ text: match[0], subscript: index > 0 })
    cursor = index + match[0].length
  }

  if (cursor < formula.length) {
    tokens.push({ text: formula.slice(cursor), subscript: false })
  }

  return tokens
}
