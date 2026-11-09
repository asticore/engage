// @vitest-environment node
import { readFileSync } from 'node:fs'
import { chromium, type Browser } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { VISUAL_EDITOR_CSS } from '@/views/visualEditor/visualEditor.styles'
import { TRANSLATION_BAR_CSS } from '@/views/visualEditor/TranslationBar'

/**
 * Renders the editor top bar markup with the real stylesheets in Chromium and checks that it fits 1024-1920px
 * without horizontal page scroll, that the left group is never covered and that save / publish stay visible.
 * Skipped when no Chromium is installed.
 */
const css =
  VISUAL_EDITOR_CSS +
  TRANSLATION_BAR_CSS +
  readFileSync('src/views/visualEditor/saveStatusChip.css', 'utf8') +
  readFileSync('src/views/visualEditor/topbar.css', 'utf8')

const shell = (extra: string): string => `<!doctype html><html><head><meta charset=utf-8><style>body{margin:0}${css}</style></head><body>
<div class="ve-root"><div class="ve-topbar">
<div class="ve-topbar__left"><a class="ve-btn ve-btn--ghost" id="back">Back</a><button class="ve-btn ve-btn--ghost ve-btn--icon" id="collapse">«</button>
<span class="ve-topbar__title" id="title">Editing: A fairly long page title for the test <span class="ve-topbar__status">(published)</span></span></div>
<div class="ve-topbar__actions">
<div class="ve-translation-bar"><label><select class="ve-translation-bar__select"><option>English (default)</option></select></label>
<button class="ve-translation-bar__chip">DE 3/10</button><button class="ve-translation-bar__chip">FR 3/10</button><button class="ve-translation-bar__chip">ES 3/10</button><button class="ve-translation-bar__chip">IT 3/10</button></div>
<div class="ve-history"><button class="ve-btn ve-btn--ghost">Undo</button><button class="ve-btn ve-btn--ghost">Redo</button></div>
${extra}
<div class="ve-shortcuts"><button class="ve-btn ve-btn--ghost">Shortcuts</button></div>
<div class="ve-device-toggle"><button class="ve-device-btn ve-device-btn--active">Desktop</button><button class="ve-device-btn">Tablet</button><button class="ve-device-btn">Mobile</button></div>
<button class="ve-btn ve-btn--icon" id="preview">E</button>
<span class="ve-save-chip ve-save-chip--dirty">Unsaved changes</span>
<button class="ve-btn" id="save">Save draft</button><button class="ve-btn ve-btn--primary" id="publish">Publish</button>
</div></div></div></body></html>`


const COMPACT_MAX = 1599
const wide = shell(`<button class="ve-btn ve-btn--ghost">Import / Export</button>`).replace('<div class="ve-device-toggle">', '<button class="ve-btn">Save as template</button><div class="ve-device-toggle">')
const narrow = shell('').replace('<div class="ve-device-toggle">', '<div class="ve-more"><button class="ve-btn ve-btn--ghost">More</button></div><div class="ve-device-toggle">')

let browser: Browser | null = null
beforeAll(async () => {
  try {
    browser = await chromium.launch()
  } catch {
    browser = null
  }
})
afterAll(async () => {
  await browser?.close()
})

describe('editor top bar layout', () => {
  for (const width of [1024, 1280, 1440, 1600, 1920]) {
    it(`fits at ${width}px`, async (ctx) => {
      if (!browser) return ctx.skip()
      const page = await browser.newPage({ viewport: { width, height: 700 } })
      await page.setContent(width > COMPACT_MAX ? wide : narrow)
      const r = await page.evaluate(() => {
        const rect = (s: string) => {
          const b = document.querySelector(s)!.getBoundingClientRect()
          return { l: b.left, r: b.right, w: b.width }
        }
        return {
          sw: document.documentElement.scrollWidth,
          iw: innerWidth,
          back: rect('#back'),
          title: rect('#title'),
          save: rect('#save'),
          publish: rect('#publish'),
          dev: rect('.ve-device-toggle'),
          actions: rect('.ve-topbar__actions'),
          left: rect('.ve-topbar__left'),
          lang: rect('.ve-translation-bar'),
          history: rect('.ve-history'),
        }
      })
      await page.close()
      expect(r.sw).toBeLessThanOrEqual(r.iw)
      expect(r.publish.r).toBeLessThanOrEqual(r.iw)
      expect(r.dev.r).toBeLessThanOrEqual(r.iw)
      expect(r.save.l).toBeGreaterThan(r.dev.r)
      expect(r.back.w).toBeGreaterThan(30)
      expect(r.title.w).toBeGreaterThan(40)
      expect(r.left.r).toBeLessThanOrEqual(r.actions.l + 1)
      expect(r.lang.w).toBeGreaterThan(90)
      expect(r.lang.r).toBeLessThanOrEqual(r.history.l + 1)
    }, 30_000)
  }

  it('hides the admin shell toggles while the editor is mounted, but not on other admin pages', async (ctx) => {
    if (!browser) return ctx.skip()
    const shellCss = readFileSync('src/views/visualEditor/veShell.css', 'utf8')
    const toggles = '<span><button class="nav-toggler">n</button></span><div class="theme-toggler">t</div>'
    const page = await browser.newPage()
    await page.setContent(`<style>${shellCss}</style><div class="admin-shell">${toggles}<div class="ve-root"></div></div>`)
    const visible = () => page.evaluate(() => [...document.querySelectorAll('.nav-toggler, .theme-toggler')].map((e) => getComputedStyle(e).display !== 'none'))
    expect(await visible()).toEqual([false, false])
    await page.setContent(`<style>${shellCss}</style><div class="admin-shell">${toggles}<main>page</main></div>`)
    expect(await visible()).toEqual([true, true])
    await page.close()
  })
})
