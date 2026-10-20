/**
 * Minimal structural types for the parts of the Kekule.js API this library
 * touches. Internal only — no ambient globals, no `declare module` patches;
 * the real `kekule` package ships untyped and is cast to these shapes by
 * {@link ./loadKekule}.
 */

/**
 * Base shape of a Kekule event parameter object. Concrete widgets carry
 * payload fields (e.g. `elemData` on periodic-table select events); this
 * base stays open so components can narrow it themselves.
 */
export interface KekuleEventParam {
  [key: string]: unknown
}

/**
 * Structural subset of `Kekule.Widget.BaseWidget` — the widget lifecycle
 * surface every wrapper component needs.
 */
export interface KekuleWidget {
  /** Set a Kekule class property by name (e.g. `'enableMultiSelect'`). */
  setPropValue(propName: string, value: unknown): void
  getPropValue(propName: string): unknown
  /** Mount the widget's root element into `element`. */
  appendToElem(element: HTMLElement): unknown
  /** Tear down the widget and its DOM — must run on component unmount. */
  finalize(): void
  addEventListener(eventName: string, handler: (event: KekuleEventParam) => void): unknown
  removeEventListener(eventName: string, handler: (event: KekuleEventParam) => void): unknown
}

/** One element cell record of the periodic table (symbol, name, …). */
export interface KekuleElementData {
  symbol: string
  [key: string]: unknown
}

/** `select` / `deselect` event payload of `ChemWidget.PeriodicTable`. */
export interface KekulePeriodicTableEventParam extends KekuleEventParam {
  elemData: KekuleElementData
}

/** `Kekule.ChemWidget.PeriodicTable`. */
export interface KekulePeriodicTableWidget extends KekuleWidget {
  /** Currently selected element symbols, in selection order. */
  getSelectedSymbols(): string[]
  /** Replace the whole selection (fires `select`/`deselect` events). */
  selectSymbols(symbols: string[]): void
}

/** `load` event payload of `Editor.Composer`. */
export interface KekuleComposerLoadEventParam extends KekuleEventParam {
  obj: unknown
}

/** `Kekule.Editor.Composer`. */
export interface KekuleComposerWidget extends KekuleWidget {
  /** The ChemDocument root shown in the editor. */
  getChemObj(): unknown
  /**
   * The object to save/export — this is the model value of
   * `ChemKekuleComposer` (unlike `getChemObj`, which returns the document
   * root rather than the save target).
   */
  getSavingTargetObj(): unknown
  /**
   * Replace editor content from serialized data (fires `load`). Upstream
   * argument order is `(data, dataType, mimeType, formatId, coordMode)` —
   * the format id ("mol", "cml", …) is the **fourth** argument, so the
   * format alone must be passed as `(data, undefined, undefined, format)`.
   */
  loadFromData(data: string, dataType?: unknown, mimeType?: unknown, formatId?: string, coordMode?: unknown): unknown
}

/** Structural subset of `Kekule.IO` used for serialization. */
export interface KekuleIONamespace {
  saveFormatData(obj: unknown, formatId: string, options?: unknown): string
}

/**
 * Structural subset of the global `Kekule` namespace. Only the members this
 * library uses are declared; `Render` stays a loose placeholder for the
 * upcoming Viewer component.
 */
export interface KekuleNamespace {
  ChemWidget: {
    /**
     * Kekule widgets take the target document as their first constructor
     * argument — it is what drives root-element creation
     * (`new ChemWidget.PeriodicTable(el.ownerDocument)`).
     */
    PeriodicTable: new (doc: Document) => KekulePeriodicTableWidget
  }
  Editor: {
    Composer: new (doc: Document) => KekuleComposerWidget
  }
  IO?: KekuleIONamespace
  Render?: Record<string, unknown>
}
