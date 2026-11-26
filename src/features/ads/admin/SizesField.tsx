'use client'

import React from 'react'
import { FieldLabel, useField } from '@/engine/ui'

import { COMMON_SIZES, hasSize, toggleSize } from '../sizes'

/** A text box for sizes plus ticks for the common ones. The stored value is the same "300x250, 320x50" text as before. */
export function SizesField({ path, field, readOnly }: { path: string; field?: { label?: unknown; admin?: { description?: unknown } }; readOnly?: boolean }) {
  const { value, setValue } = useField<string | null>({ path })
  const text = typeof value === 'string' ? value : ''
  const label = typeof field?.label === 'string' ? field.label : path.split('.').pop() || 'Sizes'
  return (
    <div className="field-type">
      <FieldLabel label={label} />
      <input type="text" value={text} disabled={readOnly} placeholder="300x250, 320x50" onChange={(e) => setValue(e.target.value)} style={{ width: '100%' }} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 6, fontSize: 12 }}>
        {COMMON_SIZES.map((c) => (
          <label key={c.size} title={c.label}>
            <input type="checkbox" disabled={readOnly} checked={hasSize(text, c.size)} onChange={() => setValue(toggleSize(text, c.size))} /> {c.size}
          </label>
        ))}
      </div>
    </div>
  )
}
