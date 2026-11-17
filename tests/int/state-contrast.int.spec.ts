// @vitest-environment node
/**
 * Task 20a: contrast for every interactive STATE (resting, hover, active, focus, disabled, selected), in light and dark.
 *
 * Loads the real admin CSS and the public Shine CSS into headless Chromium and measures what the browser resolves:
 *  - text against its effective fill: 4.5:1 (3:1 for the documented disabled exception, which WCAG exempts)
 *  - focus rings and control boundaries against the surface: 3:1
 * Colours are normalised through a canvas, so `color-mix()`, alpha and element opacity are all counted.
 * Skips (rather than fails) when no Chromium can be launched.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { chromium, type Browser, type Page } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/@import\s+['"][^'"]+['"];?/g, '')
const adminCss = ['literal-tokens.css', 'custom.css', 'edit-lock.css', 'contrast.css'].map((f) => read(`src/app/(engage)/${f}`)).join('\n')
const shineCss = read('src/styles/shine/shine.css') + '\n' + read('src/styles/a11y-states.css')

type Rgba = [number, number, number, number]
const lum = ([r, g, b]: number[]) => {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export const ratio = (fg: number[], bg: number[]) => {
  const a = lum(fg)
  const b = lum(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

const adminHtml = `<!doctype html><html><head><style>${shineCss}
@layer theme, base, components, utilities;
${adminCss}
body { margin: 20px; background: var(--ac-ground); color: var(--theme-text); }
button, a, input { margin: 6px; }
.focus-probe:focus-visible { outline: 2px solid var(--ac-gold); outline-offset: 2px; }
</style></head><body>
<button id="a-btn" class="btn">Cancel</button>
<button id="a-btn-primary" class="btn btn--primary">Save</button>
<button id="a-btn-disabled" class="btn" disabled>Cancel</button>
<button id="a-btn-primary-disabled" class="btn btn--primary" disabled>Save</button>
<button id="a-link" class="doc-link">Edit</button>
<button id="a-link-disabled" class="doc-link" disabled>Edit</button>
<div role="tablist" class="doc-seo-card__tabs"><button id="a-tab" role="tab" aria-selected="false" class="doc-seo-card__tab">Preview</button><button id="a-tab-selected" role="tab" aria-selected="true" class="doc-seo-card__tab">Settings</button></div>
</body></html>`

const shineHtml = `<!doctype html><html><head><style>${shineCss}
body { margin: 20px; }
button, a, input { margin: 6px; }
</style></head><body>
<button id="s-btn" class="btn">Buy</button>
<button id="s-btn-outline" class="btn btn-outline">Details</button>
<button id="s-btn-ghost" class="btn btn-ghost">More</button>
<button id="s-btn-soft" class="btn btn-soft">Tag</button>
<button id="s-btn-disabled" class="btn" disabled>Buy</button>
<button id="s-btn-outline-disabled" class="btn btn-outline" disabled>Details</button>
<a id="s-link" class="link" href="#">Read more</a>
<input id="s-input" class="input" value="Hello" />
<input id="s-input-disabled" class="input" value="Hello" disabled />
<span id="s-badge" class="badge">New</span>
<span id="s-badge-solid" class="badge badge-solid">Sale</span>
<span id="s-badge-outline" class="badge badge-outline">Draft</span>
<span id="s-chip" class="badge badge-outline" style="--sh-tone: var(--sh-success, green)">Filter</span>
<input id="s-switch" class="switch" type="checkbox" role="switch" aria-label="On off" />
<input id="s-switch-on" class="switch" type="checkbox" role="switch" aria-label="On" checked />
<ul class="menu" style="position:static;display:flex"><li><button id="s-menu" class="menu-item" type="button">Rename</button></li><li><a id="s-menu-active" aria-current="page" href="#">Settings</a></li></ul>
<table class="table table-hover"><tbody><tr id="s-row"><td>Row</td></tr><tr id="s-row-selected" aria-selected="true"><td>Picked</td></tr></tbody></table>
</body></html>`

type Probe = { fg: Rgba; bg: Rgba; surface: Rgba; ring: string | null; ringColor: Rgba | null; border: Rgba | null; borderWidth: number }

/** Resolved text, effective fill (compositing every translucent ancestor and element opacity), ring and border colours. */
const probe = (p: Page, id: string): Promise<Probe> =>
  p.$eval(`#${id}`, (el) => {
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!
    ctx.canvas.width = ctx.canvas.height = 1
    const norm = (c: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = c
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return [d[0], d[1], d[2], d[3] / 255]
    }
    const over = (top: number[], under: number[]): [number, number, number, number] => {
      const a = top[3] ?? 1
      return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1]
    }
    const chain: Element[] = []
    for (let n: Element | null = el; n; n = n.parentElement) chain.unshift(n)
    let bg: number[] = [255, 255, 255, 1]
    let surface: number[] = bg
    let opacity = 1
    for (const n of chain) {
      if (n === el) surface = bg
      const cs = getComputedStyle(n)
      bg = over(norm(cs.backgroundColor), bg)
      opacity *= Number(cs.opacity)
    }
    const cs = getComputedStyle(el)
    const fgRaw = norm(cs.color)
    const fg = over([fgRaw[0], fgRaw[1], fgRaw[2], fgRaw[3] * opacity], bg)
    const outlined = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
    const borderOn = cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0
    return {
      fg: fg as Rgba,
      bg: bg as Rgba,
      surface: surface as Rgba,
      ring: outlined ? cs.outlineWidth : null,
      ringColor: outlined ? over(norm(cs.outlineColor), surface) : null,
      border: borderOn ? over(norm(cs.borderTopColor), surface) : null,
      borderWidth: parseFloat(cs.borderTopWidth) || 0,
    }
  }) as Promise<Probe>

let browser: Browser | null = null
beforeAll(async () => {
  try {
    browser = await chromium.launch()
  } catch {
    browser = null
  }
}, 60_000)
afterAll(async () => {
  await browser?.close()
})

const open = async (html: string, theme: 'light' | 'dark'): Promise<Page> => {
  const page = await browser!.newPage()
  await page.emulateMedia({ colorScheme: theme })
  await page.setContent(html)
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
  await page.waitForTimeout(400) // outlast Shine's colour transitions after the theme switch
  return page
}

const states = async (page: Page, id: string) => {
  const out: Record<string, Probe> = {}
  out.resting = await probe(page, id)
  await page.hover(`#${id}`)
  await page.waitForTimeout(250)
  out.hover = await probe(page, id)
  await page.mouse.down()
  await page.waitForTimeout(250)
  out.active = await probe(page, id)
  await page.mouse.up()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(250)
  await page.keyboard.press('Tab')
  await page.focus(`#${id}`)
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  await page.focus(`#${id}`)
  await page.waitForTimeout(250)
  out.focus = await probe(page, id)
  return out
}

type Case = { id: string; html: string; text: string[]; disabled?: boolean; ring?: boolean; boundary?: boolean }
const textCases = (suite: 'admin' | 'shine'): Case[] => {
  const html = suite === 'admin' ? adminHtml : shineHtml
  const names = suite === 'admin' ? ['a-btn', 'a-btn-primary', 'a-link', 'a-tab', 'a-tab-selected'] : ['s-btn', 's-btn-outline', 's-btn-ghost', 's-btn-soft', 's-link', 's-badge', 's-badge-solid', 's-badge-outline', 's-chip', 's-menu', 's-menu-active', 's-row', 's-row-selected']
  return names.map((id) => ({ id, html, text: ['resting', 'hover', 'active', 'focus'] }))
}
const disabledCases = (suite: 'admin' | 'shine'): Case[] => {
  const html = suite === 'admin' ? adminHtml : shineHtml
  const names = suite === 'admin' ? ['a-btn-disabled', 'a-btn-primary-disabled', 'a-link-disabled'] : ['s-btn-disabled', 's-btn-outline-disabled', 's-input-disabled']
  return names.map((id) => ({ id, html, text: ['resting'], disabled: true }))
}

describe.each(['admin', 'shine'] as const)('%s state contrast', (suite) => {
  for (const theme of ['light', 'dark'] as const) {
    for (const c of textCases(suite)) {
      it(`${theme}: #${c.id} text is >= 4.5:1 in resting, hover, active and focus`, async (ctx) => {
        if (!browser) return ctx.skip()
        const page = await open(c.html, theme)
        try {
          const all = await states(page, c.id)
          for (const state of c.text) {
            const s = all[state]
            expect(ratio(s.fg, s.bg), `${c.id} ${state}`).toBeGreaterThanOrEqual(4.5)
          }
        } finally {
          await page.close()
        }
      })
    }
    for (const c of disabledCases(suite)) {
      it(`${theme}: #${c.id} disabled stays readable (>= 3:1)`, async (ctx) => {
        if (!browser) return ctx.skip()
        const page = await open(c.html, theme)
        try {
          const s = await probe(page, c.id)
          expect(ratio(s.fg, s.bg), c.id).toBeGreaterThanOrEqual(3)
        } finally {
          await page.close()
        }
      })
    }
  }
})

describe('focus rings and boundaries (>= 3:1 against the surface)', () => {
  const ringCases: Array<[string, string, string]> = [
    ['admin', adminHtml, 'a-btn'],
    ['admin', adminHtml, 'a-tab'],
    ['shine', shineHtml, 's-btn'],
    ['shine', shineHtml, 's-btn-outline'],
    ['shine', shineHtml, 's-link'],
    ['shine', shineHtml, 's-input'],
  ]
  for (const theme of ['light', 'dark'] as const) {
    for (const [suite, html, id] of ringCases) {
      it(`${theme}: ${suite} #${id} focus ring`, async (ctx) => {
        if (!browser) return ctx.skip()
        const page = await open(html, theme)
        try {
          await page.keyboard.press('Tab')
          await page.focus(`#${id}`)
          await page.keyboard.press('Shift+Tab')
          await page.keyboard.press('Tab')
          await page.focus(`#${id}`)
          const s = await probe(page, id)
          if (id === 's-input') {
            // Shine fields show focus with a tone border and glow (the outline is kept transparent for forced-colors mode).
            expect(ratio(s.border!, s.surface), `${id} focus border`).toBeGreaterThanOrEqual(3)
          } else {
            expect(s.ring, `${id} has a visible outline`).not.toBeNull()
            expect(ratio(s.ringColor!, s.surface), `${id} ring colour`).toBeGreaterThanOrEqual(3)
          }
        } finally {
          await page.close()
        }
      })
    }
    for (const id of ['s-btn-outline', 's-input']) {
      it(`${theme}: shine #${id} boundary`, async (ctx) => {
        if (!browser) return ctx.skip()
        const page = await open(shineHtml, theme)
        try {
          const s = await probe(page, id)
          expect(s.border, `${id} has a border`).not.toBeNull()
          expect(ratio(s.border!, s.surface), `${id} border`).toBeGreaterThanOrEqual(3)
        } finally {
          await page.close()
        }
      })
    }
  }
})

describe('toggle track against the surface (>= 3:1, WCAG 1.4.11)', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const id of ['s-switch', 's-switch-on']) {
      it(`${theme}: shine #${id} track`, async (ctx) => {
        if (!browser) return ctx.skip()
        const page = await open(shineHtml, theme)
        try {
          const s = await probe(page, id)
          expect(ratio(s.bg, s.surface), id).toBeGreaterThanOrEqual(3)
        } finally {
          await page.close()
        }
      })
    }
  }
})
