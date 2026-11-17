import React from 'react'

import { getBlockContext } from '@/lib/blockContext'

import { buttonClassName, type ButtonElementProps } from './ButtonElement'

/**
 * Request button element (def: src/lib/elements/requestButtonDefs.ts): a link to /request-quote for one kind of request,
 * about the product the page shows or a chosen product. Renders nothing while Quotes and requests is off.
 */

type P = Record<string, unknown>

const KIND_TEXT = { quote: 'Request a quote', bid: 'Make an offer', item: 'Request this item' } as const

/** The /request-quote address for a button's settings. The page product fills in when no product is set. */
export function requestHref(props: P, current?: { id?: number; title?: unknown }): { href: string; text: string } {
  const kind = props.kind === 'bid' || props.kind === 'item' ? props.kind : 'quote'
  const chosen = Math.floor(Number(props.productId))
  const id = Number.isInteger(chosen) && chosen > 0 ? chosen : current?.id
  const query = new URLSearchParams({ kind })
  if (id && Number.isInteger(id) && id > 0) {
    query.set('product', String(id))
    const title = !Number.isInteger(chosen) || chosen <= 0 ? (typeof current?.title === 'string' ? current.title : '') : ''
    if (title) query.set('title', title.slice(0, 120))
  }
  const text = typeof props.text === 'string' && props.text.trim() ? props.text.trim().slice(0, 80) : KIND_TEXT[kind]
  return { href: `/request-quote?${query.toString()}`, text }
}

export async function RequestButtonElement(props: P): Promise<React.ReactElement | null> {
  try {
    const { getFeatureFlags } = await import('@/utilities/features')
    if (!(await getFeatureFlags()).quotes) return null
    const { href, text } = requestHref(props, getBlockContext().product)
    const variant = (props.variant === 'secondary' || props.variant === 'plain' ? props.variant : 'primary') as ButtonElementProps['variant']
    const size = (props.size === 'sm' || props.size === 'lg' ? props.size : 'md') as ButtonElementProps['size']
    const align = props.align === 'center' || props.align === 'right' ? props.align : 'left'
    return (
      <div style={{ textAlign: align }}>
        <a className={buttonClassName(variant, undefined, size)} href={href}>
          {text}
        </a>
      </div>
    )
  } catch {
    return null
  }
}

export const REQUEST_BUTTON_COMPONENTS: Record<string, React.ComponentType<P>> = {
  'request-button': RequestButtonElement as never,
}
