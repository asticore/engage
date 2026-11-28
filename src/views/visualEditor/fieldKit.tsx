'use client'

import React, { useEffect, useId, useRef, useState } from 'react'

import { BG_IMAGE_POSITIONS, BG_IMAGE_REPEATS, BG_IMAGE_SIZES, type BlockStyle } from '@/lib/blockStyle'

import { useAdminT } from '@/admin/i18n/AdminUiProvider'
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

/** A per-device unit select for a slider row. The empty option is the default (no unit saved). */
export const UnitSelect: React.FC<{ ctl: ResponsiveCtl; unitKey: Key; label: string; defaultLabel: string; units?: readonly string[] }> = ({ ctl, unitKey, label, defaultLabel, units = ['px', 'em', 'rem', '%', 'vw', 'vh'] }) => {
  const own = ctl.own(unitKey)
  const inherited = ctl.inherited(unitKey)
  const current = typeof own === 'string' ? own : typeof inherited === 'string' ? inherited : ''
  return (
    <select aria-label={label} value={current} onChange={(e) => ctl.set(unitKey, e.target.value === '' ? undefined : e.target.value)}>
      <option value="">{defaultLabel}</option>
      {units.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
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

type Patch = (p: Partial<BlockStyle>) => void

/** Text shadow written only while hovering (x, y, blur in px, colour). Any value set turns it on. */
export const HoverTextShadowRows: React.FC<{ value: BlockStyle; patch: Patch }> = ({ value, patch }) => {
  const t = useAdminT()
  const num = (label: string, k: keyof BlockStyle, min: number, max: number) => (
    <NumberRow key={String(k)} label={label} value={typeof value[k] === 'number' ? (value[k] as number) : undefined} min={min} max={max} onChange={(v) => patch({ [k]: v } as Partial<BlockStyle>)} />
  )
  return (
    <>
      {num(t('dp.fk.hover_text_shadow_x'), 'hoverTextShadowX', -100, 100)}
      {num(t('dp.fk.hover_text_shadow_y'), 'hoverTextShadowY', -100, 100)}
      {num(t('dp.fk.hover_text_shadow_blur'), 'hoverTextShadowBlur', 0, 200)}
      <ColorRow label={t('dp.fk.hover_text_shadow_colour')} value={value.hoverTextShadowColor} onChange={(v) => patch({ hoverTextShadowColor: v })} />
    </>
  )
}

const numRow = (value: BlockStyle, patch: Patch, label: string, k: keyof BlockStyle, min: number, max: number) => (
  <NumberRow key={String(k)} label={label} value={typeof value[k] === 'number' ? (value[k] as number) : undefined} min={min} max={max} onChange={(v) => patch({ [k]: v } as Partial<BlockStyle>)} />
)

/** Border width for each side (top, right, bottom, left). A side left empty uses the main border width. */
export const BorderSidesPopover: React.FC<{ value: BlockStyle; patch: Patch }> = ({ value, patch }) => {
  const t = useAdminT()
  const keys = ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'] as const
  const [linked, setLinked] = useState(false)
  const first = value.borderTopWidth
  return (
    <Row label="Border sides">
      <PopoverGroup label="Edit" summary={keys.some((k) => typeof value[k] === 'number') ? '(set)' : undefined}>
        <label className="ve-row ve-row--check">
          <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} />
          <span className="ve-row__label">{t('dp.fk.link_all_sides')}</span>
        </label>
        {linked ? (
          <NumberRow label={t('dp.fk.all_sides_px')} value={typeof first === 'number' ? first : undefined} min={0} max={50} onChange={(v) => patch(Object.fromEntries(keys.map((k) => [k, v])) as Partial<BlockStyle>)} />
        ) : (
          <>
            {numRow(value, patch, 'Top (px)', 'borderTopWidth', 0, 50)}
            {numRow(value, patch, 'Right (px)', 'borderRightWidth', 0, 50)}
            {numRow(value, patch, 'Bottom (px)', 'borderBottomWidth', 0, 50)}
            {numRow(value, patch, 'Left (px)', 'borderLeftWidth', 0, 50)}
          </>
        )}
      </PopoverGroup>
    </Row>
  )
}

/** Custom box shadow (x, y, blur, spread, colour, inset) for Normal and for Hover, replacing the preset when set. */
export const BoxShadowPopover: React.FC<{ value: BlockStyle; patch: Patch }> = ({ value, patch }) => {
  const t = useAdminT()
  const [tab, setTab] = useState<'bs' | 'bs2' | 'bs3' | 'hbs'>('bs')
  const k = (s: string) => `${tab}${s}` as keyof BlockStyle
  const inset = value[k('Inset')] === true
  const any = ['bsX', 'bsY', 'bsBlur', 'bsSpread', 'bsColor', 'bs2X', 'bs2Y', 'bs2Blur', 'bs2Spread', 'bs2Color', 'bs3X', 'bs3Y', 'bs3Blur', 'bs3Spread', 'bs3Color', 'hbsX', 'hbsY', 'hbsBlur', 'hbsSpread', 'hbsColor'].some((x) => (value as Record<string, unknown>)[x] !== undefined)
  return (
    <Row label="Custom shadow">
      <PopoverGroup label="Edit" summary={any ? '(set)' : undefined}>
        <SelectRow label="State" value={tab} options={[{ label: 'Normal', value: 'bs' }, { label: 'Second layer', value: 'bs2' }, { label: t('dp.fk.third_layer'), value: 'bs3' }, { label: 'Hover', value: 'hbs' }]} onChange={(v) => setTab(v === 'hbs' || v === 'bs2' || v === 'bs3' ? v : 'bs')} />
        {numRow(value, patch, 'X (px)', k('X'), -200, 200)}
        {numRow(value, patch, 'Y (px)', k('Y'), -200, 200)}
        {numRow(value, patch, 'Blur (px)', k('Blur'), 0, 300)}
        {numRow(value, patch, 'Spread (px)', k('Spread'), -100, 200)}
        <ColorRow label="Colour" value={value[k('Color')] as string | undefined} onChange={(v) => patch({ [k('Color')]: v } as Partial<BlockStyle>)} />
        <label className="ve-row ve-row--check">
          <input type="checkbox" checked={inset} onChange={(e) => patch({ [k('Inset')]: e.target.checked ? true : undefined } as Partial<BlockStyle>)} />
          <span className="ve-row__label">Inset</span>
        </label>
      </PopoverGroup>
    </Row>
  )
}

const opts = (values: readonly string[], none: string) => [{ label: none, value: '' }, ...values.map((v) => ({ label: v.charAt(0).toUpperCase() + v.slice(1), value: v }))]

/** Image background size, position, repeat and attachment. Empty keeps the default (cover, centred, no repeat, scrolls). */
export const BgImagePlacement: React.FC<{ value: BlockStyle; set: (k: keyof BlockStyle, v: unknown) => void }> = ({ value, set }) => {
  const row = (label: string, k: keyof BlockStyle, values: readonly string[], none: string) => (
    <SelectRow
      key={String(k)}
      label={label}
      value={(value[k] as string | undefined) ?? ''}
      options={opts(values, none)}
      applied={value[k] !== undefined}
      onReset={() => set(k, undefined)}
      onChange={(v) => set(k, v || undefined)}
    />
  )
  return (
    <>
      {row('Image size', 'bgImageSize', BG_IMAGE_SIZES, 'Cover (default)')}
      {row('Image position', 'bgImagePosition', BG_IMAGE_POSITIONS, 'Centre (default)')}
      {row('Image repeat', 'bgImageRepeat', BG_IMAGE_REPEATS, 'No repeat (default)')}
      {row('Image attachment', 'bgImageAttachment', ['scroll', 'fixed'], 'Scrolls (default)')}
    </>
  )
}

/** Image mask: the address of an SVG or PNG (https or on this site) and how it is sized, placed and repeated. */
export const MaskImageRows: React.FC<{ value: BlockStyle; set: (k: keyof BlockStyle, v: unknown) => void }> = ({ value, set }) => {
  const sel = (label: string, k: keyof BlockStyle, values: readonly string[], none: string) => (
    <SelectRow key={String(k)} label={label} value={(value[k] as string | undefined) ?? ''} options={opts(values, none)} applied={value[k] !== undefined} onReset={() => set(k, undefined)} onChange={(v) => set(k, v || undefined)} />
  )
  return (
    <>
      <Row label="Mask image (SVG or PNG address)" applied={value.maskImageUrl !== undefined} onReset={() => set('maskImageUrl', undefined)}>
        <input type="text" value={value.maskImageUrl ?? ''} placeholder="https://... or /media/shape.svg" onChange={(e) => set('maskImageUrl', e.target.value.trim() || undefined)} />
      </Row>
      {value.maskImageUrl && (
        <>
          {sel('Mask size', 'maskImageSize', BG_IMAGE_SIZES, 'Contain (default)')}
          {sel('Mask position', 'maskImagePosition', ['center', 'top', 'bottom', 'left', 'right'], 'Centre (default)')}
          {sel('Mask repeat', 'maskImageRepeat', BG_IMAGE_REPEATS, 'No repeat (default)')}
        </>
      )}
    </>
  )
}
