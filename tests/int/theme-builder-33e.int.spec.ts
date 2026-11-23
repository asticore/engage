// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { applyClonedTheme, countColours, extractThemeFromText } from '@/features/themeStyles/cloneSite'
import { applyThemeOverrides, describeColourOverrides, sanitizeThemeOverrides } from '@/features/themeStyles/inherit'
import { sanitizeThemeStyles } from '@/features/themeStyles/sanitize'
import { loadAllDomainOverrides, saveDomainOverrides } from '@/features/themeStyles/domainStore'
import { sampleHomepage } from '@/admin/views/themeStyles/ThemeStylesPreview'

const master = sanitizeThemeStyles(null)

describe('master theme and domain overrides', () => {
  it('inherits everything when nothing is overridden', () => {
    expect(applyThemeOverrides(master, sanitizeThemeOverrides(null))).toBe(master)
  })

  it('overrides only the chosen tokens and leaves the master untouched', () => {
    const before = JSON.stringify(master)
    const overrides = sanitizeThemeOverrides({ colours: { accent: { value: '#FF0000' }, nope: { value: 'red; x' } }, buttonRadius: 20 })
    const result = applyThemeOverrides(master, overrides)
    expect(result.colours.find((c) => c.id === 'accent')?.value).toBe('#ff0000')
    expect(result.colours.find((c) => c.id === 'primary')?.value).toBe(master.colours.find((c) => c.id === 'primary')?.value)
    expect(result.buttons.every((b) => b.radius === 20)).toBe(true)
    expect(JSON.stringify(master)).toBe(before)
  })

  it('marks overridden colours and refuses unsafe values', () => {
    const overrides = sanitizeThemeOverrides({ colours: { accent: { value: 'javascript:alert(1)' }, text: { darkValue: '#fff' } } })
    const rows = describeColourOverrides(master, overrides)
    expect(rows.find((r) => r.id === 'accent')?.overridden).toBe(false)
    expect(rows.find((r) => r.id === 'text')?.overridden).toBe(true)
  })

  it('stores and removes overrides per host', async () => {
    const rows = new Map<string, string>()
    const d1 = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => ({
          all: async <T,>() => ({ results: [...rows.entries()].map(([host, data]) => ({ host, data })) as unknown as T[] }),
          run: async () => {
            if (/^INSERT/.test(sql)) rows.set(args[0] as string, args[1] as string)
            if (/^DELETE/.test(sql)) rows.delete(args[0] as string)
          },
        }),
      }),
    }
    await saveDomainOverrides('shop.example.com', { colours: { accent: { value: '#00ff00' } } }, d1)
    expect((await loadAllDomainOverrides(d1)).get('shop.example.com')?.colours.accent.value).toBe('#00ff00')
    await saveDomainOverrides('shop.example.com', {}, d1)
    expect((await loadAllDomainOverrides(d1)).has('shop.example.com')).toBe(false)
    await expect(saveDomainOverrides('bad host!', {}, d1)).rejects.toThrow()
  })
})

describe('clone a theme from a site', () => {
  const css = 'body{background:#fafafa;color:#222;font-family:"Inter",sans-serif} h1{font-family:"Playfair Display",serif} a{color:#0a84ff} .btn{background:#0a84ff;border-radius:6px} .x{border:1px solid #e5e5e5;color:#0a84ff} .card{background:#f1f1f1;border-radius:6px}'

  it('counts colours and proposes a palette', () => {
    expect(countColours(css)[0]).toEqual({ hex: '#0a84ff', uses: 3 })
    const theme = extractThemeFromText(`<meta name="theme-color" content="#0a84ff"><style>${css}</style>`)
    const byId = Object.fromEntries(theme.colours.map((c) => [c.id, c.value]))
    expect(byId.background).toBe('#fafafa')
    expect(byId.text).toBe('#222222')
    expect(byId.accent).toBe('#0a84ff')
    expect(theme.headingFont).toBe('Playfair Display')
    expect(theme.bodyFont).toBe('Inter')
    expect(theme.radius).toBe(6)
  })

  it('applies only the colours the owner ticked', () => {
    const theme = extractThemeFromText(`<style>${css}</style>`)
    const next = applyClonedTheme(master, theme, { colours: ['accent'], radius: false })
    expect(next.colours.find((c) => c.id === 'accent')?.value).toBe('#0a84ff')
    expect(next.colours.find((c) => c.id === 'background')?.value).toBe(master.colours.find((c) => c.id === 'background')?.value)
  })

  it('reports a page with no colours', () => {
    expect(extractThemeFromText('<p>hello</p>').note).toMatch(/No colours/)
  })
})

describe('sample homepage', () => {
  it('draws header, hero, cards, shop card, form and footer', () => {
    const html = sampleHomepage(master)
    for (const part of ['<header', 'Welcome to your new site', 'Feature one', 'Shop product', '<form', '<footer']) expect(html).toContain(part)
  })
})
