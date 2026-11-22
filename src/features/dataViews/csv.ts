import { csvCell } from '@/components/blocks/elements/sparkData'

import { rawCell } from './format'
import type { DataViewModel } from './types'

/** The view's data as CSV: a header row of column labels, then one line per row. */
export function modelToCsv(model: DataViewModel): string {
  const { columns, rows } = model.data
  const lines = [columns.map((c) => csvCell(c.label)).join(',')]
  for (const row of rows) lines.push(columns.map((_, i) => csvCell(rawCell(row[i] ?? null))).join(','))
  return lines.join('\n')
}
