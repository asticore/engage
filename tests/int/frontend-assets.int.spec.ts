// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ASSET_PRESETS, SHINE_CSS_FALLBACK, SHINE_CSS_INTEGRITY, SHINE_CSS_URL, SPARK_BASE_URL, SPARK_FALLBACK_BASE, SPARK_LOADER_INTEGRITY } from '@/features/frontendAssets/builtin'
import { assetCspAdditions, assetsFor, cleanUrl, extendPolicy, MAX_ASSETS, normaliseAssets, validateAssets } from '@/features/frontendAssets/config'

const sri = (file: string): string => `sha384-${createHash('sha384').update(readFileSync(join(process.cwd(), 'public', file))).digest('base64')}`

describe('Shine and Spark release references', () => {
  it('point at the stable major channel of the releases on jsDelivr, not at the deployment', () => {
    expect(SHINE_CSS_URL).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/asticore\/shine@v\d+\/dist\/shine\.min\.css$/)
    expect(SPARK_BASE_URL).toMatch(/^https:\/\/cdn\.jsdelivr\.net\/gh\/asticore\/spark@v\d+\/dist\/$/)
  })
  it('the bundled fallback copies match the integrity hashes', () => {
    expect(sri(SHINE_CSS_FALLBACK)).toBe(SHINE_CSS_INTEGRITY)
    expect(sri(`${SPARK_FALLBACK_BASE}spark.auto.min.js`)).toBe(SPARK_LOADER_INTEGRITY)
  })
  it('the public stylesheet no longer bundles Shine', () => {
    const css = readFileSync(join(process.cwd(), 'src/app/(frontend)/styles.css'), 'utf8')
    expect(css).not.toMatch(/@import[^;]*shine\.css/)
    expect(css).toContain('@layer shine.tokens')
  })
})

describe('extra front-end files', () => {
  it('presets are https with a valid integrity value where given', () => {
    for (const preset of ASSET_PRESETS) {
      const cfg = normaliseAssets({ assets: preset.assets })
      expect(cfg.assets).toHaveLength(preset.assets.length)
      preset.assets.forEach((a, i) => expect(cfg.assets[i]!.integrity).toBe(a.integrity ?? ''))
    }
  })
  it('refuses anything but a plain https address', () => {
    for (const bad of ['http://x.com/a.css', 'javascript:alert(1)', '//cdn.x.com/a.js', 'https://user:pw@x.com/a.js', 'https://localhost/a.js', 'not a url']) expect(cleanUrl(bad)).toBeNull()
    expect(validateAssets({ assets: [{ url: 'http://x.com/a.css' }] })).toMatch(/https/)
    expect(validateAssets({ assets: [{ url: 'https://x.com/a.css', integrity: 'nope' }] })).toMatch(/integrity/)
    expect(validateAssets({ assets: Array.from({ length: MAX_ASSETS + 1 }, () => ({ url: 'https://x.com/a.css' })) })).toMatch(/At most/)
  })
  it('normalises and keeps ids unique', () => {
    const cfg = normaliseAssets({ assets: [{ id: 'a', url: 'https://x.com/a.js', kind: 'js', position: 'body' }, { id: 'a', url: 'https://x.com/b.css', kind: 'css', position: 'body', defer: false }, { url: 'ftp://x.com/c.css' }] })
    expect(cfg.assets).toHaveLength(2)
    expect(new Set(cfg.assets.map((a) => a.id)).size).toBe(2)
    expect(cfg.assets[0]).toMatchObject({ kind: 'js', position: 'body', defer: true })
    expect(cfg.assets[1]).toMatchObject({ kind: 'css', position: 'head', defer: false })
  })
  it('splits by page kind and skips disabled entries', () => {
    const cfg = normaliseAssets({
      assets: [
        { id: 'a', url: 'https://x.com/a.css', scope: 'site' },
        { id: 'b', url: 'https://x.com/b.js', kind: 'js', scope: 'portal' },
        { id: 'c', url: 'https://x.com/c.js', kind: 'js', position: 'body' },
        { id: 'd', url: 'https://x.com/d.css', enabled: false },
      ],
    })
    expect(assetsFor(cfg, false).css.map((a) => a.id)).toEqual(['a'])
    expect(assetsFor(cfg, false).bodyScripts.map((a) => a.id)).toEqual(['c'])
    expect(assetsFor(cfg, true).headScripts.map((a) => a.id)).toEqual(['b'])
    expect(assetsFor(cfg, true).css).toEqual([])
  })
  it('adds hosts to the policy without widening anything else', () => {
    const cfg = normaliseAssets({ assets: [{ url: 'https://cdn.example.com/a.js', kind: 'js' }, { url: 'https://css.example.com/a.css' }] })
    const add = assetCspAdditions(cfg)
    expect(add).toEqual({ script: ['https://cdn.example.com'], style: ['https://css.example.com'], font: ['https://css.example.com'] })
    const out = extendPolicy("default-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self'", add)
    expect(out).toContain("script-src 'self' 'unsafe-inline' https://cdn.example.com")
    expect(out).toContain("style-src 'self' https://css.example.com")
    expect(out).toContain("font-src 'self' https://css.example.com")
    expect(out).toContain("img-src 'self'")
    expect(extendPolicy("img-src 'self'", add)).toBe("img-src 'self'")
    expect(extendPolicy("default-src 'self'", { script: [], style: [], font: [] })).toBe("default-src 'self'")
  })
})
