// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  DAY_MS,
  frequencyAllows,
  autoTriggersOf,
  hasAutoTrigger,
  hrefOpensPopup,
  idleElapsed,
  popupCloseRules,
  isExitIntent,
  isLikelyBot,
  popupHref,
  scrollThresholdReached,
} from '@/lib/popupTriggers'
import fs from 'node:fs'
import React from 'react'
import { renderToString } from 'react-dom/server'

import { SectionBlock } from '@/components/blocks/SectionBlock'
import { modalDataAttrs, modalStyleVars, parseSectionLayout } from '@/lib/sectionLayout'
import { globalCards, globalNode } from '@/views/visualEditor/libraryGlobals'

describe('popup trigger sanitiser', () => {
  it('keeps valid trigger and frequency keys', () => {
    expect(
      parseSectionLayout({ display: 'modal', popupDelay: 5, popupScroll: 40, popupExit: true, popupFrequency: 'days', popupDays: 7 }),
    ).toEqual({ display: 'modal', popupDelay: 5, popupScroll: 40, popupExit: true, popupFrequency: 'days', popupDays: 7 })
  })
  it('rejects bad values', () => {
    const out = parseSectionLayout({ display: 'modal', popupDelay: -1, popupScroll: 101, popupExit: 'yes', popupFrequency: 'hourly', popupDays: 0.5 })
    expect(out).toEqual({ display: 'modal' })
    expect(parseSectionLayout({ popupDelay: '5', popupScroll: 0, popupDays: 400 })).toBeUndefined()
    expect(parseSectionLayout({ popupDelay: 1.5 })).toBeUndefined()
  })
  it('drops the default frequency', () => {
    expect(parseSectionLayout({ popupFrequency: 'always', popupExit: false })).toBeUndefined()
  })
})

describe('popup decisions', () => {
  it('builds and matches popup hrefs', () => {
    expect(popupHref('promo')).toBe('#popup-promo')
    expect(popupHref('bad id')).toBeNull()
    expect(hrefOpensPopup('#popup-promo', 'promo')).toBe(true)
    expect(hrefOpensPopup('#popup-other', 'promo')).toBe(false)
    expect(hrefOpensPopup('#popup-promo', undefined)).toBe(false)
  })
  it('applies frequency rules', () => {
    const now = 1_000_000_000_000
    expect(frequencyAllows(undefined, undefined, { shownThisSession: true }, now)).toBe(true)
    expect(frequencyAllows('session', undefined, { shownThisSession: true }, now)).toBe(false)
    expect(frequencyAllows('session', undefined, {}, now)).toBe(true)
    expect(frequencyAllows('days', 3, {}, now)).toBe(true)
    expect(frequencyAllows('days', 3, { lastShownMs: now - 2 * DAY_MS }, now)).toBe(false)
    expect(frequencyAllows('days', 3, { lastShownMs: now - 3 * DAY_MS }, now)).toBe(true)
  })
  it('detects scroll threshold, exit intent and bots', () => {
    expect(scrollThresholdReached(500, 1000, 3000, 25)).toBe(true)
    expect(scrollThresholdReached(499, 1000, 3000, 25)).toBe(false)
    expect(scrollThresholdReached(0, 1000, 800, 10)).toBe(false)
    expect(isExitIntent(-1, true)).toBe(true)
    expect(isExitIntent(300, true)).toBe(false)
    expect(isExitIntent(0, false)).toBe(false)
    expect(isLikelyBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
    expect(isLikelyBot('Mozilla/5.0 Chrome/120', true)).toBe(true)
    expect(isLikelyBot('Mozilla/5.0 Chrome/120')).toBe(false)
  })
})

describe('library Global group', () => {
  it('lists reusable sections and skips junk', () => {
    expect(globalCards([{ id: 3, name: ' Footer CTA ', description: 'x' }, { id: '4', name: 'B' }, { id: 0, name: 'z' }, { id: 5 }, null])).toEqual([
      { id: 3, name: 'Footer CTA', description: 'x' },
      { id: 4, name: 'B', description: '' },
    ])
    expect(globalCards(undefined)).toEqual([])
  })
  it('inserts a reusableSection reference block', () => {
    expect(globalNode(3)).toEqual({ blockType: 'reusableSection', section: 3 })
  })
})

describe('popup idle trigger and presentation options', () => {
  it('idleElapsed compares the quiet time with the setting', () => {
    expect(idleElapsed(0, 4999, 5)).toBe(false)
    expect(idleElapsed(0, 5000, 5)).toBe(true)
    expect(idleElapsed(1000, 500, 5)).toBe(false)
    expect(idleElapsed(NaN, 9999, 5)).toBe(false)
    expect(idleElapsed(0, 9999, 0)).toBe(false)
  })
  it('idle is an automatic trigger', () => {
    const t = autoTriggersOf(parseSectionLayout({ display: 'modal', popupIdle: 30 }))
    expect(t).toEqual({ delaySec: undefined, scrollPct: undefined, idleSec: 30, exit: false })
    expect(hasAutoTrigger(t)).toBe(true)
  })
  it('clamps and drops the new layout keys', () => {
    expect(parseSectionLayout({ display: 'modal', popupIdle: 4 })).toEqual({ display: 'modal' })
    expect(parseSectionLayout({ display: 'modal', popupIdle: 601 })).toEqual({ display: 'modal' })
    expect(parseSectionLayout({ display: 'modal', popupIdle: 5.5 })).toEqual({ display: 'modal' })
    expect(parseSectionLayout({ display: 'modal', popupIdle: 600 })).toEqual({ display: 'modal', popupIdle: 600 })
    expect(parseSectionLayout({ display: 'modal', popupOverlay: 91 })).toEqual({ display: 'modal' })
    expect(parseSectionLayout({ display: 'modal', popupOverlay: 0 })).toEqual({ display: 'modal', popupOverlay: 0 })
    expect(parseSectionLayout({ display: 'modal', popupOverlay: 60 })).toEqual({ display: 'modal' })
    expect(parseSectionLayout({ display: 'modal', popupCloseOnOverlay: true, popupShowClose: true })).toEqual({ display: 'modal' })
    expect(parseSectionLayout({ display: 'modal', popupCloseOnOverlay: false, popupShowClose: false })).toEqual({
      display: 'modal',
      popupCloseOnOverlay: false,
      popupShowClose: false,
    })
    expect(parseSectionLayout({ display: 'modal', popupAnim: 'spin', popupPosition: 'left' })).toEqual({ display: 'modal' })
    expect(parseSectionLayout({ display: 'modal', popupAnim: 'none', popupPosition: 'center' })).toEqual({ display: 'modal' })
    expect(parseSectionLayout({ display: 'modal', popupAnim: 'zoom', popupPosition: 'right' })).toEqual({
      display: 'modal',
      popupAnim: 'zoom',
      popupPosition: 'right',
    })
  })
  it('emits overlay variable and data attributes only when set', () => {
    expect(modalStyleVars({ display: 'modal' })).toEqual({ '--be-modal-width': '640px' })
    expect(modalStyleVars({ display: 'modal', popupOverlay: 30 })['--be-modal-overlay']).toBe('0.3')
    expect(modalDataAttrs({ display: 'modal' })).toEqual({})
    expect(modalDataAttrs({ display: 'modal', popupAnim: 'fade', popupPosition: 'top' })).toEqual({ 'data-anim': 'fade', 'data-pos': 'top' })
    expect(modalDataAttrs({ display: 'tabs', popupAnim: 'fade' })).toEqual({})
  })
  it('a popup can never be made impossible to close', () => {
    expect(popupCloseRules(undefined)).toEqual({ showClose: true, closeOnOverlay: true })
    expect(popupCloseRules({ popupCloseOnOverlay: false })).toEqual({ showClose: true, closeOnOverlay: false })
    expect(popupCloseRules({ popupShowClose: false })).toEqual({ showClose: false, closeOnOverlay: true })
    expect(popupCloseRules({ popupShowClose: false, popupCloseOnOverlay: false })).toEqual({ showClose: false, closeOnOverlay: true })
  })
  it('renders the options into the markup', () => {
    const columns: { blocks: unknown[] }[] = [{ blocks: [] }]
    const render = (layout: Record<string, unknown>) =>
      renderToString(React.createElement(SectionBlock, { columns, renderNode: (): null => null, design: { layout: { display: 'modal', ...layout } }, scope: 'p' }))
    const plain = render({})
    expect(plain).toContain('be-modal__close')
    expect(plain).toContain('<label for="be-p-m" class="be-modal__backdrop"')
    expect(plain).not.toContain('data-anim')
    const noClose = render({ popupShowClose: false, popupCloseOnOverlay: false, popupAnim: 'fade', popupPosition: 'bottom', popupOverlay: 20 })
    expect(noClose).not.toContain('be-modal__close')
    expect(noClose).toContain('<label for="be-p-m" class="be-modal__backdrop"')
    expect(noClose).toContain('data-anim="fade"')
    expect(noClose).toContain('data-pos="bottom"')
    expect(noClose).toContain('--be-modal-overlay:0.2')
    const inert = render({ popupCloseOnOverlay: false })
    expect(inert).toContain('be-modal__backdrop--inert')
    expect(inert).toContain('be-modal__close')
  })
  it('popup.css animates and respects reduced motion; the overlay colour is driven by the variable', () => {
    const css = fs.readFileSync('src/components/blocks/popup.css', 'utf8')
    expect(css).toContain('prefers-reduced-motion:reduce')
    expect(css).toMatch(/prefers-reduced-motion:reduce\)\{[\s\S]*animation:none/)
    for (const a of ['fade', 'slide-up', 'zoom']) expect(css).toContain(`data-anim="${a}"`)
    for (const p of ['top', 'bottom', 'right']) expect(css).toContain(`data-pos="${p}"`)
    expect(fs.readFileSync('src/components/blocks/tabs.css', 'utf8')).toContain('var(--be-modal-overlay,.6)')
  })
})
