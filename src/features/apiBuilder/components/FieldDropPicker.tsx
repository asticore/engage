'use client'

import React, { useState } from 'react'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'

/**
 * Drag and drop field picker for the endpoint builder. Left: fields the collection offers. Right: the fields
 * the endpoint exposes, in the order they are returned. Drag a field across to expose it, drag exposed fields
 * to reorder. Every move also has a button, so the picker works from the keyboard and on touch screens.
 */

export type PickerField = { key: string; label: string }

/** Pure list moves, kept apart so they are unit-tested without a browser. */
export const addField = (selected: readonly string[], key: string, at?: number): string[] => {
  if (selected.includes(key)) return [...selected]
  const next = [...selected]
  next.splice(at === undefined ? next.length : Math.max(0, Math.min(at, next.length)), 0, key)
  return next
}
export const removeField = (selected: readonly string[], key: string): string[] => selected.filter((k) => k !== key)
export const moveField = (selected: readonly string[], key: string, to: number): string[] => {
  const from = selected.indexOf(key)
  if (from < 0) return [...selected]
  const next = [...selected]
  next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, key)
  return next
}

export const FieldDropPicker: React.FC<{ fields: readonly PickerField[]; selected: string[]; onChange: (next: string[]) => void }> = ({ fields, selected, onChange }) => {
  const t = useAdminT()
  const [dragging, setDragging] = useState<string | null>(null)
  const label = (key: string): string => fields.find((f) => f.key === key)?.label ?? key
  const available = fields.filter((f) => !selected.includes(f.key))

  const dropAt = (index: number) => {
    if (!dragging) return
    onChange(selected.includes(dragging) ? moveField(selected, dragging, index > selected.indexOf(dragging) ? index - 1 : index) : addField(selected, dragging, index))
    setDragging(null)
  }
  const drag = (key: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', key)
      e.dataTransfer.effectAllowed = 'move'
      setDragging(key)
    },
    onDragEnd: () => setDragging(null),
  })
  const over = (e: React.DragEvent) => e.preventDefault()
  const box: React.CSSProperties = { border: '1px dashed var(--theme-elevation-250, #aaa)', padding: '0.5rem', minHeight: '6rem', display: 'grid', gap: '0.25rem', alignContent: 'start' }
  const chip: React.CSSProperties = { display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.25rem 0.5rem', border: '1px solid var(--theme-elevation-150, #ddd)', cursor: 'grab' }

  return (
    <div>
      <small>{t('apiBuilder.dnd.help')}</small>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))', gap: '1rem' }}>
        <div>
          <strong>{t('apiBuilder.dnd.available')}</strong>{' '}
          <button type="button" onClick={() => onChange([...selected, ...available.map((f) => f.key)])} disabled={available.length === 0}>
            {t('apiBuilder.dnd.addAll')}
          </button>
          <div style={box} onDragOver={over} onDrop={() => dragging && selected.includes(dragging) && (onChange(removeField(selected, dragging)), setDragging(null))}>
            {available.map((f) => (
              <div key={f.key} style={chip} {...drag(f.key)}>
                <span style={{ flex: 1 }}>{f.label}</span>
                <button type="button" onClick={() => onChange(addField(selected, f.key))}>
                  {t('apiBuilder.dnd.add')}
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <strong>{t('apiBuilder.dnd.exposed')}</strong>
          <div style={box} onDragOver={over} onDrop={() => dropAt(selected.length)}>
            {selected.length === 0 && <small>{t('apiBuilder.dnd.empty')}</small>}
            {selected.map((key, i) => (
              <div key={key} style={chip} {...drag(key)} onDragOver={over} onDrop={(e) => (e.stopPropagation(), dropAt(i))}>
                <span style={{ flex: 1 }}>{label(key)}</span>
                <button type="button" aria-label={t('apiBuilder.dnd.up')} disabled={i === 0} onClick={() => onChange(moveField(selected, key, i - 1))}>
                  ↑
                </button>
                <button type="button" aria-label={t('apiBuilder.dnd.down')} disabled={i === selected.length - 1} onClick={() => onChange(moveField(selected, key, i + 1))}>
                  ↓
                </button>
                <button type="button" onClick={() => onChange(removeField(selected, key))}>
                  {t('apiBuilder.dnd.remove')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
