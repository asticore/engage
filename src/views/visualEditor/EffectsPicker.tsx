'use client'

import React from 'react'

import { applyEffect, currentEffect, EFFECT_CATALOG, readEffectOptions } from '@/features/effects/catalog'

/**
 * Effects picker for the Design panel: choose an Spark effect and set its options. It writes the effect's `spark-` class
 * into the CSS classes field and the options into Custom attributes, so the two fields below stay the source of truth.
 */
export const EffectsPicker: React.FC<{
  cssClasses: string | undefined
  customAttrs: string | undefined
  onChange: (next: { cssClasses: string | undefined; customAttrs: string | undefined }) => void
}> = ({ cssClasses, customAttrs, onChange }) => {
  const effect = currentEffect(cssClasses)
  const values = effect ? readEffectOptions(effect, customAttrs) : {}
  const groups = [...new Set(EFFECT_CATALOG.map((e) => e.group))]
  const setOption = (attr: string, value: string) => onChange(applyEffect({ cssClasses, customAttrs }, effect?.id ?? null, { ...values, [attr]: value }))

  return (
    <div className="ve-row">
      <label className="ve-row__label" htmlFor="ve-effect-picker">Effect (Spark)</label>
      <select
        id="ve-effect-picker"
        value={effect?.id ?? ''}
        onChange={(e) => onChange(applyEffect({ cssClasses, customAttrs }, e.target.value || null))}
      >
        <option value="">None</option>
        {groups.map((group) => (
          <optgroup key={group} label={group}>
            {EFFECT_CATALOG.filter((e) => e.group === group).map((e) => (
              <option key={e.id} value={e.id}>{e.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {effect && <p className="ve-row__help">{effect.help} Adds the class <code>{effect.className}</code>. Runs on the live page, not in the editor.</p>}
      {effect?.options.map((option) => (
        <div key={option.attr} className="ve-row">
          <label className="ve-row__label">{option.label}</label>
          {option.type === 'select' ? (
            <select value={values[option.attr] ?? ''} onChange={(e) => setOption(option.attr, e.target.value)}>
              <option value="">Default</option>
              {option.values?.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          ) : option.type === 'boolean' ? (
            <input type="checkbox" checked={values[option.attr] === 'true'} onChange={(e) => setOption(option.attr, e.target.checked ? 'true' : '')} />
          ) : (
            <input type={option.type === 'number' ? 'number' : 'text'} value={values[option.attr] ?? ''} placeholder={option.placeholder} onChange={(e) => setOption(option.attr, e.target.value)} />
          )}
        </div>
      ))}
    </div>
  )
}
