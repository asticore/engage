import React from 'react'

import { EventGridBlock } from '../EventGridBlock'
import { FaqBlockBlock } from '../FaqBlockBlock'
import { ProductGridBlock } from '../ProductGridBlock'

type P = Record<string, unknown>

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined)
const int = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : undefined

/** FAQ ids typed as "1, 2, 3" (or already a list). Anything that is not an id is dropped. */
export function parseFaqIds(value: unknown): (number | string)[] {
  const parts = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const ids: (number | string)[] = []
  for (const part of parts) {
    const text = String(part).trim()
    if (/^\d+$/.test(text)) ids.push(Number(text))
    else if (/^[A-Za-z0-9_-]{1,64}$/.test(text)) ids.push(text)
  }
  return ids.slice(0, 100)
}

/** `event-grid`: the same cards the Event Grid block drew. */
export const EventGridElement = (p: P): React.ReactElement => <EventGridBlock heading={str(p.heading)} showPast={p.showPast === true} limit={int(p.limit, 1, 24)} />

/** `faq-list`: the same accordion the FAQ block drew. */
export const FaqListElement = (p: P): React.ReactElement => (
  <FaqBlockBlock heading={str(p.heading)} source={p.source === 'manual' ? 'manual' : 'category'} category={str(p.category)} faqs={parseFaqIds(p.faqs)} />
)

/** `product-grid`: the same cards the Product Grid block drew. */
export const ProductGridElement = (p: P): React.ReactElement => <ProductGridBlock heading={str(p.heading)} category={str(p.category)} limit={int(p.limit, 1, 24)} />

/** `section-params` only declares inputs for a reusable section; it draws nothing. */
export const SectionParamsElement = (): null => null

export const LEGACY_REPLACEMENT_COMPONENTS: Record<string, React.ComponentType<P>> = {
  'section-params': SectionParamsElement as unknown as React.ComponentType<P>,
  'event-grid': EventGridElement as unknown as React.ComponentType<P>,
  'faq-list': FaqListElement as unknown as React.ComponentType<P>,
  'product-grid': ProductGridElement as unknown as React.ComponentType<P>,
}
