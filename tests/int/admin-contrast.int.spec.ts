// @vitest-environment node
/**
 * Hover/focus contrast guard for the admin buttons, in BOTH admin themes.
 *
 * Loads the real custom.css + contrast.css (+ edit-lock.css) into headless
 * Chromium (so cascade layers behave exactly as in the app), hovers each
 * button type and asserts the resolved foreground/background ratio is >= 4.5.
 * Tailwind utilities are not compiled here, so the two utility classes the
 * dashboard create buttons use are mimicked inside `@layer utilities`, which
 * is what reproduces the original gold-on-gold bug (an unlayered `a { color }`
 * beating a layered `hover:text-*`).
 *
 * Skips (rather than fails) when no Chromium binary can be launched.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { chromium, type Browser, type Page } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const dir = join(process.cwd(), 'src/app/(engage)')
const read = (f: string) => readFileSync(join(dir, f), 'utf8').replace(/@import\s+['"][^'"]+['"];?/g, '')

const css = [read('literal-tokens.css'), read('custom.css'), read('edit-lock.css'), read('contrast.css')].join('\n')

// Stand-ins for the compiled Tailwind utilities the dashboard/media/events create buttons carry.
const utilities = `
@layer utilities {
  .text-gold { color: var(--ac-gold); }
  .text-e500 { color: var(--theme-elevation-500); }
  .border-gold { border: 1px solid var(--ac-gold); }
  .hover\\:bg-\\[var\\(--ac-gold\\)\\]:hover { background-color: var(--ac-gold); }
  .hover\\:text-\\[var\\(--theme-elevation-0\\)\\]:hover { color: var(--theme-elevation-0); }
}`

const html = `<!doctype html><html><head><style>@layer theme, base, components, utilities;
${css}
${utilities}
body { margin: 20px; background: var(--ac-ground); }
button, a { display: inline-block; margin: 6px; }
</style></head><body>
<button id="primary" class="btn btn--primary"><span>Save</span></button>
<button id="secondary" class="btn">Cancel</button>
<a id="dash-create" href="#" class="text-gold border-gold hover:bg-[var(--ac-gold)] hover:text-[var(--theme-elevation-0)]"><svg width="10" height="10"></svg><span>New page</span></a>
<a id="dash-plus" href="#" class="text-e500 hover:bg-[var(--ac-gold)] hover:text-[var(--theme-elevation-0)]">+</a>
<button id="filter-apply" class="list-filter-apply-btn">Apply</button>
<div class="edit-lock-banner edit-lock-banner--warning"><button id="lock-warn" class="edit-lock-banner__button">Take over</button></div>
<div class="edit-lock-banner edit-lock-banner--taken-over"><button id="lock-taken" class="edit-lock-banner__button">Reload</button></div>
</body></html>`

const targets = ['primary', 'secondary', 'dash-create', 'dash-plus', 'filter-apply', 'lock-warn', 'lock-taken']

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
const rgb = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)

let browser: Browser | null = null
let page: Page | null = null

beforeAll(async () => {
  try {
    browser = await chromium.launch()
    page = await browser.newPage()
    await page.setContent(html)
  } catch {
    browser = null
  }
}, 60_000)
afterAll(async () => {
  await browser?.close()
})

const measure = async (p: Page, id: string) => {
  await p.hover(`#${id}`)
  await p.waitForTimeout(250) // outlast the 100-150ms colour transitions
  return p.$eval(`#${id}`, (el) => {
    const cs = getComputedStyle(el)
    return { fg: cs.color, bg: cs.backgroundColor }
  })
}

describe('admin button hover contrast', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const id of targets) {
      it(`${theme}: #${id} hover text vs fill is >= 4.5:1`, async (ctx) => {
        if (!browser || !page) return ctx.skip()
        await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme)
        const { fg, bg } = await measure(page, id)
        expect(bg, 'hovered element must have an opaque fill').not.toBe('rgba(0, 0, 0, 0)')
        expect(ratio(rgb(fg), rgb(bg))).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})
