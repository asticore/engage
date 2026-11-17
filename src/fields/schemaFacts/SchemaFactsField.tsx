'use client'

import React, { useMemo } from 'react'
import { FieldLabel, useField, useFormFields } from '@/engine/ui'
import { FACT_FIELDS, isRichType, parseFacts, validateRich, type Facts } from '@/features/seo/richTypes'

/** Form-style editor for the page type facts. Stores the same JSON text as before. */
export const SchemaFactsField: React.FC<{ path: string; readOnly?: boolean }> = ({ path, readOnly }) => {
  const { value, setValue } = useField<string>({ path })
  const schemaType = useFormFields(([fields]) => fields?.['schemaType']?.value) as string | undefined
  const facts = useMemo(() => parseFacts(value), [value])
  if (!isRichType(schemaType)) return null
  const defs = FACT_FIELDS[schemaType]
  const { missing, recommended } = validateRich(schemaType, facts)
  const label = (key: string) => defs.find((d) => d.key === key)?.label ?? key

  const update = (key: string, raw: string, kind: string) => {
    const next: Facts = { ...facts }
    if (kind === 'lines') {
      const lines = raw.split('\n')
      if (lines.some((l) => l.trim())) next[key] = lines
      else delete next[key]
    } else if (raw.trim() === '') delete next[key]
    else next[key] = raw
    setValue(Object.keys(next).length ? JSON.stringify(next) : '')
  }

  return (
    <div className="field-type schema-facts-field">
      <FieldLabel htmlFor={`field-${path}`} label="Page type facts" />
      <div className="field-description">Fill in what you know. Required facts are marked with a star.</div>
      {defs.map((d) => {
        const required = missing.includes(d.key) || recommended.includes(d.key) ? true : false
        const raw = facts[d.key]
        const text = Array.isArray(raw) ? raw.join('\n') : raw === undefined || raw === null ? '' : String(raw)
        const id = `${path}-${d.key}`
        const common = { id, disabled: readOnly, value: text, 'aria-describedby': d.hint ? `${id}-hint` : undefined }
        return (
          <div key={d.key} className="field-type text" data-missing={required ? 'true' : undefined}>
            <label htmlFor={id}>{d.label}{missing.includes(d.key) ? ' *' : ''}</label>
            {d.input === 'lines' ? (
              <textarea {...common} rows={4} onChange={(e) => update(d.key, e.target.value, d.input)} />
            ) : (
              <input {...common} type={d.input === 'number' ? 'number' : d.input === 'date' ? 'date' : 'text'} onChange={(e) => update(d.key, e.target.value, d.input)} />
            )}
            {d.hint && <div id={`${id}-hint`} className="field-description">{d.hint}</div>}
          </div>
        )
      })}
      {missing.length > 0 && <div className="field-error" role="status">Missing required: {missing.map(label).join(', ')}</div>}
      {missing.length === 0 && recommended.length > 0 && <div className="field-description" role="status">Recommended: {recommended.map(label).join(', ')}</div>}
    </div>
  )
}

export default SchemaFactsField
