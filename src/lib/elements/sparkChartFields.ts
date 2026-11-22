import { EFFECT_CATALOG, type EffectDef, type EffectOption } from '@/features/effects/catalog'

import type { EditorField } from './fieldTypes'

/**
 * The Chart element lists every Spark chart, diagram and visualisation (the catalogue under features/effects is generated
 * from the Spark release) and builds the option fields from each effect's own meta, so a new Spark release adds charts
 * and options by regenerating the catalogue. Option props are stored as `o_<effect id>_<attr>` and rendered as
 * `data-spark-<attr>` (components/blocks/elements/sparkData.ts).
 */

export const CHART_GROUPS = ['Charts', 'Diagrams', 'Visualisations']
export const CHART_EFFECTS: EffectDef[] = EFFECT_CATALOG.filter((e) => CHART_GROUPS.includes(e.group))
export const DEFAULT_CHART = 'chart-bar'

/** Charts whose data is a table: the data editor takes CSV (header row = series names, first column = labels). */
export const TABULAR_CHARTS = ['chart-bar', 'chart-line', 'chart-combo', 'chart-radar', 'chart-pie', 'chart-polar', 'chart-funnel', 'chart-waterfall', 'chart-heatmap', 'chart-progress', 'chart-treemap']
/** Attributes the element handles itself (data editor, title) or that Engage fills in from elsewhere. */
const SKIP_ATTRS = new Set(['data', 'csv', 'source', 'live', 'background', 'title'])

/** The effect id for a stored chartType. The first version stored bar, line, pie, radar or polar. */
export function chartEffectId(v: unknown): string {
  const raw = typeof v === 'string' ? v : ''
  if (CHART_EFFECTS.some((e) => e.id === raw)) return raw
  if (CHART_EFFECTS.some((e) => e.id === `chart-${raw}`)) return `chart-${raw}`
  return DEFAULT_CHART
}

const humanise = (attr: string) => {
  const s = attr.replace(/-/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const plain = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

function optionField(effect: EffectDef, o: EffectOption): EditorField {
  const base = { name: `o_${effect.id}_${o.attr}`, label: humanise(o.attr), helpText: plain(o.label), showIf: { field: 'chartType', equals: effect.id } }
  if (o.type === 'boolean') return { ...base, type: 'checkbox' }
  if (o.type === 'number') return { ...base, type: 'number', width: 'half' }
  if (o.type === 'select' && o.values?.length) return { ...base, type: 'select', width: 'half', options: [{ label: 'Default', value: '' }, ...o.values.map((v) => ({ label: humanise(v), value: v }))] }
  return { ...base, type: 'text' }
}

/** One fixed list of fields: picker, title, data, then every option of every chart type shown only for its type. */
export function chartFields(): EditorField[] {
  const fields: EditorField[] = [
    {
      name: 'chartType',
      label: 'Chart type',
      type: 'select',
      options: CHART_EFFECTS.map((e) => ({ label: e.label, value: e.id, group: e.group })),
      helpText: 'Every chart, diagram and visualisation Spark offers.',
    },
    { name: 'title', label: 'Title', type: 'text', helpText: 'Shown above the chart and read by screen readers.' },
    {
      name: 'data',
      label: 'Data',
      type: 'textarea',
      helpText: 'CSV: first row = series names, first column = labels, for example "Month,Sales" then "Jan,120". Paste from a spreadsheet saved as CSV.',
      showIf: { field: 'chartType', in: TABULAR_CHARTS },
    },
  ]
  for (const e of CHART_EFFECTS) {
    const dataOption = e.options.find((o) => o.attr === 'data')
    if (dataOption && !TABULAR_CHARTS.includes(e.id)) {
      fields.push({ name: `d_${e.id}`, label: 'Data', type: 'textarea', helpText: plain(dataOption.label), showIf: { field: 'chartType', equals: e.id } })
    }
    for (const o of e.options) if (!SKIP_ATTRS.has(o.attr)) fields.push(optionField(e, o))
  }
  return fields
}
