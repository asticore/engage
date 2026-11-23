'use client'

import React, { useEffect, useId, useRef, useState } from 'react'

import type { BlockStyle } from '@/lib/blockStyle'

import { ColorRow, NumberRow, Row, SelectRow, UNIT_OPTIONS, type ResponsiveCtl } from './DesignPanel'

/**
 * Shared field kit (Task 12, 31h): the reusable pieces a design control is built from, so a new control gets
 * per-device values, a unit, and a popover group without new plumbing. Responsive and Normal | Hover handling
 * stay in makeResponsive and the state tabs; this file adds the Length field (value + one of six units),
 * the popover group, and the controls that use them.
 */

type Key = Parameters<ResponsiveCtl['own']>[0]

/** A button that opens a small panel next to it (not a modal). Closes on Escape (focus returns) and on a click outside. */
export const PopoverGroup: React.FC<{ label: string; summary?: string; children: React.ReactNode }> = ({ label, summary, children }) => {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])
  return (
    <div
      ref={root}
      className="ve-popover"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
          button.current?.focus()
        }
      }}
    >
      <button ref={button} type="button" className="ve-popover__btn" aria-expanded={open} aria-controls={id} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        {label}
        {summary ? <span className="ve-popover__summary"> {summary}</span> : null}
      </button>
      {open && (
        <div id={id} role="dialog" aria-label={label} className="ve-popover__panel">
          {children}
        </div>
      )}
    </div>
  )
}

/** One length: a number and one of the six units (px, %, em, rem, vw, vh), both per device. Unit unset means px. */
export const LengthField: React.FC<{ ctl: ResponsiveCtl; k: Key; unitKey: Key; label: string; help?: string }> = ({ ctl, k, unitKey, label, help }) => {
  const own = ctl.own(k)
  const inherited = ctl.inherited(k)
  const ownUnit = ctl.own(unitKey)
  const unit = typeof ownUnit === 'string' ? ownUnit : typeof ctl.inherited(unitKey) === 'string' ? (ctl.inherited(unitKey) as string) : 'px'
  return (
    <NumberRow
      label={label}
      help={help}
      value={typeof own === 'number' ? own : undefined}
      placeholder={typeof inherited === 'number' ? String(inherited) : undefined}
      min={0}
      resp={ctl.resp(k)}
      applied={own !== undefined}
      onReset={() => ctl.setMany({ [k]: undefined, [unitKey]: undefined })}
      onChange={(v) => ctl.set(k, v)}
    >
      <select aria-label={`${label} unit`} value={unit} onChange={(e) => ctl.set(unitKey, e.target.value === 'px' ? undefined : e.target.value)}>
        {UNIT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </NumberRow>
  )
}

/** Min width, max width and max height, each per device with a unit. 0 on a max means no limit (clears an inherited one). */
export const SizeLimitRows: React.FC<{ ctl: ResponsiveCtl }> = ({ ctl }) => (
  <>
    <LengthField ctl={ctl} k={'minWidth' as Key} unitKey={'minWidthUnit' as Key} label="Minimum width" />
    <LengthField ctl={ctl} k={'maxWidth' as Key} unitKey={'maxWidthUnit' as Key} label="Maximum width" help="0 means no limit." />
    <LengthField ctl={ctl} k={'maxHeight' as Key} unitKey={'maxHeightUnit' as Key} label="Maximum height" help="0 means no limit." />
  </>
)

/** Flip horizontal and vertical, per device. Turning it off on a device that inherits a flip writes an explicit 0. */
export const FlipRows: React.FC<{ ctl: ResponsiveCtl }> = ({ ctl }) => (
  <>
    {(['tfFlipX', 'tfFlipY'] as const).map((k) => {
      const key = k as Key
      const on = (ctl.effective(key) ?? 0) === 1
      return (
        <SelectRow
          key={k}
          label={k === 'tfFlipX' ? 'Flip horizontal' : 'Flip vertical'}
          value={on ? 'on' : 'off'}
          options={[
            { label: 'Off', value: 'off' },
            { label: 'On', value: 'on' },
          ]}
          resp={ctl.resp(key)}
          applied={ctl.own(key) !== undefined}
          onReset={() => ctl.reset(key)}
          onChange={(v) => {
            if (v === 'on') ctl.set(key, 1)
            else if (ctl.device !== 'desktop' && ctl.inherited(key) === 1) ctl.set(key, 0)
            else ctl.reset(key)
          }}
        />
      )
    })}
  </>
)

/** Custom text shadow (x, y, blur, colour) and text stroke (width, colour), in one popover. */
export const TextShadowStrokePopover: React.FC<{ value: BlockStyle; patch: (p: Partial<BlockStyle>) => void }> = ({ value, patch }) => {
  const num = (label: string, k: keyof BlockStyle, min: number, max: number) => (
    <NumberRow label={label} value={typeof value[k] === 'number' ? (value[k] as number) : undefined} min={min} max={max} onChange={(v) => patch({ [k]: v } as Partial<BlockStyle>)} />
  )
  const summary = value.textStrokeWidth || value.textShadowX !== undefined || value.textShadowY !== undefined || value.textShadowBlur !== undefined || value.textShadowColor ? '(set)' : undefined
  return (
    <Row label="Text shadow and stroke">
      <PopoverGroup label="Edit" summary={summary}>
        {num('Shadow x (px)', 'textShadowX', -100, 100)}
        {num('Shadow y (px)', 'textShadowY', -100, 100)}
        {num('Shadow blur (px)', 'textShadowBlur', 0, 200)}
        <ColorRow label="Shadow colour" value={value.textShadowColor} onChange={(v) => patch({ textShadowColor: v })} />
        {num('Stroke width (px)', 'textStrokeWidth', 0, 20)}
        <ColorRow label="Stroke colour" value={value.textStrokeColor} onChange={(v) => patch({ textStrokeColor: v })} />
      </PopoverGroup>
    </Row>
  )
}
