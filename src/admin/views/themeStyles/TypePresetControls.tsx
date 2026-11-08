'use client'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
import { useId, useState } from 'react'

import { LIMITS, type TextTransform, type TypePreset } from '@/features/themeStyles/types'

import { addTypePreset, patchTypePreset, removeTypePreset } from './editorLogic'
import { SelectField, TextField, WEIGHT_OPTIONS } from './fields'
import type { InstalledFontOption } from './TypographyControls'

type Props = {
  presets: TypePreset[]
  fonts: InstalledFontOption[]
  onChange: (presets: TypePreset[]) => void
}

/** A number input where an empty box means "not set" (the preset leaves that property alone). */
function OptionalNumber({ label, value, min, max, step = 1, onChange }: { label: string; value: number | undefined; min: number; max: number; step?: number; onChange: (value: number | undefined) => void }) {
  const id = useId()
  return (
    <div className="ts-field">
      <label htmlFor={id} className="ts-label">{label}</label>
      <input
        id={id}
        type="number"
        className="ts-input"
        value={value === undefined ? '' : value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          if (event.target.value.trim() === '') return onChange(undefined)
          const next = Number(event.target.value)
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)))
        }}
      />
    </div>
  )
}

/** "Text styles": global typography presets (Primary, Secondary, Text, Accent and your own), picked per block in the editor. */
export function TypePresetControls({ presets, fonts, onChange }: Props) {
  const t = useAdminT()
  const [newName, setNewName] = useState('')
  const set = (id: string, patch: Partial<Record<keyof TypePreset, unknown>>) => onChange(patchTypePreset(presets, id, patch))
  const inherit = t('ty.lit.inherit')
  const fontOptions = [
    { value: '', label: inherit },
    { value: 'heading', label: t('ty.lit.heading_font') },
    { value: 'body', label: t('ty.lit.body_font') },
    ...fonts.map((f) => ({ value: f.id, label: f.label })),
  ]
  const weightOptions = [{ value: 0, label: inherit }, ...WEIGHT_OPTIONS]
  const transformOptions: { value: TextTransform | ''; label: string }[] = [
    { value: '', label: inherit },
    { value: 'none', label: t('tp.transform_none') },
    { value: 'uppercase', label: t('tp.transform_upper') },
    { value: 'lowercase', label: t('tp.transform_lower') },
    { value: 'capitalize', label: t('tp.transform_capitalize') },
  ]
  const unitOptions = ['px', 'em', 'rem', 'vw'].map((u) => ({ value: u, label: u }))

  return (
    <div>
      <h3 className="ts-section">{t('tp.title')}</h3>
      <p className="ts-help">{t('tp.help')}</p>
      <div className="ts-list" style={{ marginTop: 8 }}>
        {presets.length === 0 && <p className="ts-help">{t('tp.empty')}</p>}
        {presets.map((p) => (
          <section key={p.id} className="ts-item" aria-label={p.name}>
            <div className="ts-item__head">
              <h3 className="ts-item__title">{p.name}</h3>
              <button type="button" className="ts-btn ts-btn--danger" aria-label={t('aria.delete', { name: p.name })} onClick={() => onChange(removeTypePreset(presets, p.id))}>{t('ty.lit.delete')}</button>
            </div>
            <div className="ts-grid">
              <TextField label={t('ty.lit.name')} value={p.name} maxLength={LIMITS.name} onChange={(name) => set(p.id, { name: name || p.id })} />
              <SelectField label={t('ty.lit.font')} value={p.fontFamily ?? ''} options={fontOptions} onChange={(fontFamily) => set(p.id, { fontFamily })} />
              <OptionalNumber label={t('tp.size')} value={p.fontSize} min={0.1} max={400} step={0.1} onChange={(fontSize) => set(p.id, { fontSize })} />
              <SelectField label={t('tp.unit')} value={p.fontSizeUnit ?? 'px'} options={unitOptions} onChange={(fontSizeUnit) => set(p.id, { fontSizeUnit })} />
              <SelectField label={t('ty.lit.weight')} value={p.fontWeight ?? 0} options={weightOptions} onChange={(fontWeight) => set(p.id, { fontWeight: fontWeight || undefined })} />
              <OptionalNumber label={t('ty.lit.line_height')} value={p.lineHeight} min={0.5} max={5} step={0.05} onChange={(lineHeight) => set(p.id, { lineHeight })} />
              <OptionalNumber label={t('ty.lit.letter_spacing_px')} value={p.letterSpacing} min={-20} max={50} step={0.1} onChange={(letterSpacing) => set(p.id, { letterSpacing })} />
              <SelectField<TextTransform | ''> label={t('ty.lit.transform')} value={p.textTransform ?? ''} options={transformOptions} onChange={(textTransform) => set(p.id, { textTransform })} />
            </div>
          </section>
        ))}
      </div>
      <div className="ts-inline" style={{ marginTop: 12 }}>
        <div style={{ minWidth: 200 }}>
          <TextField label={t('ty.lit.name')} value={newName} maxLength={LIMITS.name} onChange={setNewName} />
        </div>
        <button
          type="button"
          className="ts-btn"
          style={{ alignSelf: 'flex-end' }}
          disabled={presets.length >= LIMITS.typePresets}
          onClick={() => { onChange(addTypePreset(presets, newName)); setNewName('') }}
        >
          {t('tp.add')}
        </button>
      </div>
    </div>
  )
}
