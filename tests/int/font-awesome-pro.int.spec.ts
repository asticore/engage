// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { assetCspAdditions, assetsFor, normaliseAssets, validateAssets } from '@/features/frontendAssets/config'
import { cleanKitCode, cleanProUrl, fontAwesomeTag, iconClass, normaliseFontAwesome, proStylesAvailable } from '@/features/frontendAssets/fontAwesome'

const kit = { mode: 'kit', kitCode: '1A2B3C4D5E' }

describe('Font Awesome Pro licence (31g)', () => {
  it('pulls a kit code out of a pasted address', () => {
    expect(cleanKitCode('https://kit.fontawesome.com/1a2b3c4d5e.js')).toBe('1a2b3c4d5e')
    expect(cleanKitCode('<script src="https://kit.fontawesome.com/1a2b3c4d5e.js"></script>')).toBe('1a2b3c4d5e')
    expect(cleanKitCode('nope')).toBe('')
  })
  it('accepts only https Font Awesome hosts for a stylesheet', () => {
    expect(cleanProUrl('https://kit-pro.fontawesome.com/releases/v6/css/pro.min.css')).not.toBe('')
    for (const bad of ['http://use.fontawesome.com/a.css', 'https://evil.com/a.css', 'https://u:p@use.fontawesome.com/a.css', 'x']) expect(cleanProUrl(bad)).toBe('')
  })
  it('a half filled form stays off', () => {
    expect(normaliseFontAwesome({ mode: 'kit', kitCode: '' }).mode).toBe('off')
    expect(normaliseFontAwesome({ mode: 'cdn', cdnUrl: 'https://evil.com/x.css' }).mode).toBe('off')
    expect(validateAssets({ assets: [], fontAwesome: { mode: 'kit', kitCode: 'zz' } })).toMatch(/kit code/)
  })
  it('a kit becomes one head script and its hosts join the CSP', () => {
    const cfg = normaliseAssets({ assets: [], fontAwesome: kit })
    expect(cfg.fontAwesome?.kitCode).toBe('1a2b3c4d5e')
    expect(fontAwesomeTag(cfg.fontAwesome!)).toEqual({ kind: 'js', url: 'https://kit.fontawesome.com/1a2b3c4d5e.js' })
    const live = assetsFor(cfg, false)
    expect(live.headScripts.map((a) => a.url)).toEqual(['https://kit.fontawesome.com/1a2b3c4d5e.js'])
    const csp = assetCspAdditions(cfg)
    expect(csp.script).toContain('https://kit.fontawesome.com')
    expect(csp.font).toContain('https://ka-p.fontawesome.com')
  })
  it('removing the licence writes nothing and falls back to the free set', () => {
    const cfg = normaliseAssets({ assets: [], fontAwesome: { mode: 'off', kitCode: '1a2b3c4d5e' } })
    expect(cfg.fontAwesome).toBeUndefined()
    expect(assetsFor(cfg, true).headScripts).toHaveLength(0)
    expect(proStylesAvailable(normaliseFontAwesome(undefined))).toBe(false)
    expect(iconClass('fa-light fa-heart', normaliseFontAwesome(undefined))).toBe('fa-solid fa-heart')
  })
  it('Pro icon styles are kept only while a licence is on', () => {
    const on = normaliseFontAwesome(kit)
    expect(iconClass('fa-duotone fa-heart', on)).toBe('fa-duotone fa-heart')
    expect(iconClass('fa-solid fa-heart', on)).toBe('fa-solid fa-heart')
    expect(iconClass('fa-heart', on)).toBe('fa-solid fa-heart')
  })
})
