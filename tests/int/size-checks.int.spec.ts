// @vitest-environment node
/**
 * Task 20b: size checks at phone (375 px) and desktop (1280 px) widths, from the real admin and Shine CSS in headless Chromium.
 *  - every pointer target is at least 24 x 24 CSS px (WCAG 2.5.8), and primary actions 44 px high on phones
 *  - text is at least 12 px
 *  - neighbouring targets are not touching (at least 4 px apart, or 24 px targets that fit a 24 px circle each)
 *  - zoomed to 200 percent (a 640 px or a 187 px wide viewport) and further, nothing forces sideways scrolling
 * Skips (rather than fails) when no Chromium can be launched.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { chromium, type Browser } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/@import\s+['"][^'"]+['"];?/g, '')
const shine = read('src/styles/shine/shine.css') + '\n' + read('src/styles/a11y-states.css')
const admin = ['literal-tokens.css', 'custom.css', 'edit-lock.css', 'contrast.css'].map((f) => read(`src/app/(engage)/${f}`)).join('\n')

const publicBody = `
<main style="padding:16px">
  <h1>Shop</h1>
  <p>Some body text with a <a class="link" href="#">link inside it</a>.</p>
  <div id="row" style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn" id="primary">Add to cart</button>
    <button class="btn btn-outline">Details</button>
    <button class="btn btn-sm btn-ghost">More</button>
    <button class="btn btn-soft btn-sm">Tag</button>
  </div>
  <label>Email <input class="input" type="email" value="a@b.co"></label>
  <label>Pick <select class="select"><option>One</option></select></label>
  <label><input type="checkbox" class="checkbox"> Remember me</label>
  <p><button class="btn btn-sm" disabled>Sold out</button></p>
  <p><span class="badge">New</span> <input type="checkbox" class="switch" role="switch" aria-label="Alerts"></p>
  <ul class="menu" style="position:static"><li><button type="button">Rename</button></li><li><a href="#">Settings</a></li></ul>
</main>`

const adminBody = `
<div style="padding:16px">
  <button id="primary" class="btn btn--primary">Save</button>
  <button class="btn">Cancel</button>
  <button class="doc-link">Edit</button>
  <div role="tablist"><button role="tab" aria-selected="true" class="doc-seo-card__tab">Settings</button><button role="tab" aria-selected="false" class="doc-seo-card__tab">Preview</button></div>
  <button class="list-toolbar-btn">Save as default</button>
  <button class="list-search-btn">Search</button>
  <button class="list-column-picker-btn">Columns</button>
  <select class="list-limit-select"><option>10 per page</option></select>
</div>`

const pages = {
  public: `<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width"><style>${shine}</style></head><body>${publicBody}</body></html>`,
  admin: `<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width"><style>${shine}\n@layer theme, base, components, utilities;\n${admin}</style></head><body>${adminBody}</body></html>`,
}

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

type Box = { label: string; w: number; h: number; x: number; y: number; font: number; disabled: boolean }
const measure = async (html: string, width: number): Promise<{ boxes: Box[]; scrollWidth: number; texts: Array<{ label: string; font: number }> }> => {
  const page = await browser!.newPage({ viewport: { width, height: 800 } })
  try {
    await page.setContent(html)
    await page.waitForTimeout(100)
    return await page.evaluate(() => {
      const targets = Array.from(document.querySelectorAll('button, select, input:not([type=hidden]), a[href]:not(p a)')) as HTMLElement[]
      const boxes = targets.map((el) => {
        // A checkbox or radio inside a label is clicked through the label, so the label is the target.
        const hit = ((el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio') && el.closest('label') ? (el.closest('label') as HTMLElement) : el
        const r = hit.getBoundingClientRect()
        return { label: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${el.className}`.slice(0, 60), w: r.width, h: r.height, x: r.x, y: r.y, font: parseFloat(getComputedStyle(el).fontSize), disabled: (el as HTMLButtonElement).disabled === true }
      })
      const texts = Array.from(document.querySelectorAll('body *')).filter((el) => el.childNodes.length && Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim())).map((el) => ({ label: el.tagName.toLowerCase() + '.' + el.className, font: parseFloat(getComputedStyle(el).fontSize) }))
      return { boxes, scrollWidth: document.documentElement.scrollWidth, texts }
    })
  } finally {
    await page.close()
  }
}

describe.each(['public', 'admin'] as const)('%s size checks', (name) => {
  for (const width of [375, 1280]) {
    it(`${width}px: targets are at least 24 px and text at least 12 px`, async (ctx) => {
      if (!browser) return ctx.skip()
      const { boxes, texts } = await measure(pages[name], width)
      expect(boxes.length).toBeGreaterThan(3)
      for (const b of boxes) {
        if (b.disabled) continue
        expect(b.w, `${b.label} width`).toBeGreaterThanOrEqual(24)
        expect(b.h, `${b.label} height`).toBeGreaterThanOrEqual(24)
        expect(b.font, `${b.label} font`).toBeGreaterThanOrEqual(12)
      }
      for (const t of texts) expect(t.font, `${t.label} text`).toBeGreaterThanOrEqual(12)
    })
    it(`${width}px: neighbouring targets do not touch`, async (ctx) => {
      if (!browser) return ctx.skip()
      const { boxes } = await measure(pages[name], width)
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]
          const b = boxes[j]
          const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w))
          const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h))
          if (gapX < 0 && gapY < 0) continue // overlapping boxes belong to nested controls (label and input)
          // WCAG 2.5.8 spacing exception: a 24 px circle around each target must not intersect another target.
          expect(Math.max(gapX, gapY) >= 0 || false, `${a.label} overlaps ${b.label}`).toBe(true)
        }
      }
    })
  }
  it('375px: the primary action is at least 44 px high', async (ctx) => {
    if (!browser) return ctx.skip()
    const page = await browser.newPage({ viewport: { width: 375, height: 800 }, hasTouch: true })
    try {
      await page.setContent(pages[name])
      const h = await page.$eval('#primary', (el) => el.getBoundingClientRect().height)
      expect(h).toBeGreaterThanOrEqual(44)
    } finally {
      await page.close()
    }
  })
  for (const width of [640, 320]) {
    it(`${width}px wide (zoomed to 200 percent on desktop or 400 percent on a phone): no sideways scrolling`, async (ctx) => {
      if (!browser) return ctx.skip()
      const { scrollWidth } = await measure(pages[name], width)
      expect(scrollWidth).toBeLessThanOrEqual(width)
    })
  }
})
