import React from 'react'

import { renderElement } from '@/components/blocks/elements/renderElement'

import { modelToCsv } from '../csv'
import { loadDataView } from '../load'

/**
 * A Chart or Table element whose data comes from a saved Data view (Content > Tables and charts): the view's rows
 * replace the typed data and every other option of the element still applies. Only public views are used, like the
 * Table or chart element. A private or missing view falls back to the data typed in the element.
 */
export const DataViewBackedElement = async ({ elementType, props }: { elementType: 'chart' | 'table'; props: Record<string, unknown> }): Promise<React.ReactNode> => {
  const raw = props.view
  const ref = raw && typeof raw === 'object' ? (raw as { id?: unknown }).id : raw
  if (typeof ref !== 'number' && typeof ref !== 'string') return renderElement(elementType, props)
  const result = await loadDataView(String(ref), { requirePublic: true })
  if (result.status !== 'ok') return renderElement(elementType, props)
  const csv = modelToCsv(result.model)
  return renderElement(elementType, elementType === 'table' ? { ...props, rows: csv, headerRow: true } : { ...props, data: csv })
}
