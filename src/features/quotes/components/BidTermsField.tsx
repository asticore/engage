'use client'

import React from 'react'
import { FieldLabel, useField } from '@/engine/ui'
import type { Field } from '@/engine'

type Props = { field: Field; path: string; readOnly?: boolean }

const cell: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }

/** Admin card for a product's offer terms: one JSON column `{ minimum, endsAt }` (D1 caps a table at 100 columns). */
export function BidTermsField({ path, readOnly }: Props) {
  const { setValue, value } = useField<unknown>({ path })
  const terms = (value && typeof value === 'object' ? value : {}) as { minimum?: number | null; endsAt?: string | null }
  const update = (patch: { minimum?: number | null; endsAt?: string | null }) => setValue({ ...terms, ...patch })
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
      <div style={cell}>
        <FieldLabel htmlFor={`${path}-minimum`} label="Lowest offer taken" required={false} />
        <input
          id={`${path}-minimum`}
          type="number"
          min={0}
          readOnly={readOnly === true}
          title="In the shop currency. Blank or 0 means any amount."
          value={terms.minimum ?? ''}
          onChange={(e) => update({ minimum: e.target.value === '' ? null : Number(e.target.value) })}
        />
      </div>
      <div style={cell}>
        <FieldLabel htmlFor={`${path}-ends`} label="Offers close" required={false} />
        <input
          id={`${path}-ends`}
          type="datetime-local"
          readOnly={readOnly === true}
          title="At that time the highest offer is sent a quote at its price and the others are told they were not successful. Blank means no end: staff pick the winner."
          value={terms.endsAt ? String(terms.endsAt).slice(0, 16) : ''}
          onChange={(e) => update({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
        />
      </div>
    </div>
  )
}
