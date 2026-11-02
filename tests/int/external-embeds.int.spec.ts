// @vitest-environment node
// External embeds: the admin helpers, the theme picks, the hosted address, the frame and origin rules.
import { describe, expect, it } from 'vitest'

import { embedAdminRow, embedOutputs, parseAllowedOrigins } from '@/features/forms/embedAdmin'
import { checkOrigin, checkSiteOrigin } from '@/features/forms/origin'
import { cleanEmbedOrigins, cleanEmbedTheme, embedThemeStyle, newEmbedKey, RESERVED_EMBED_KEYS, type EmbedRecord } from '@/features/forms/embeds'
import { decideEmbedFrame, embedPathKey } from '@/features/forms/embedFrame'

const embed = (over: Partial<EmbedRecord> = {}): EmbedRecord => ({
  id: 4,
  formId: 9,
  name: 'Partner blog',
  embedKey: 'abcd2345efgh67',
  enabled: true,
  allowedOrigins: ['https://partner.example'],
  theme: {},
  createdAt: '2026-03-06T00:00:00.000Z',
  updatedAt: '2026-03-06T00:00:00.000Z',
  ...over,
})

describe('parseAllowedOrigins', () => {
  it('takes one website per line, bare hosts as https, and drops duplicates', () => {
    const parsed = parseAllowedOrigins('example.com\nhttps://example.com\n\n')
    expect(parsed.origins).toEqual(['https://example.com'])
    expect(parsed.invalid).toEqual([])
  })

  it('accepts a wildcard subdomain and reports addresses with a path', () => {
    const parsed = parseAllowedOrigins('https://*.example.com\nexample.com/blog')
    expect(parsed.origins).toEqual(['https://*.example.com'])
    expect(parsed.invalid).toEqual(['example.com/blog'])
  })

  it('returns nothing for an empty box, meaning any website', () => {
    expect(parseAllowedOrigins('   ').origins).toEqual([])
  })
})

describe('embedAdminRow', () => {
  it('shows the embed with its own name, the title of its form and the form status', () => {
    const row = embedAdminRow(embed(), { title: 'Contact', formStatus: 'draft' })
    expect(row).toMatchObject({ id: 4, formId: 9, formTitle: 'Contact', formPublished: false, name: 'Partner blog', enabled: true })
  })

  it('falls back to the form number when the form has no title', () => {
    expect(embedAdminRow(embed(), { title: '' }).formTitle).toBe('Form #9')
  })
})

describe('embedOutputs', () => {
  it('builds the hosted address at /embed/<key> and both snippets from the site origin and key', () => {
    const out = embedOutputs('abcd2345efgh67', 'https://site.example/')
    expect(out.hostedUrl).toBe('https://site.example/embed/abcd2345efgh67')
    expect(out.scriptSnippet).toContain('src="https://site.example/embed/forms.js"')
    expect(out.scriptSnippet).toContain('data-form="abcd2345efgh67"')
    expect(out.iframeSnippet).toContain('src="https://site.example/embed/abcd2345efgh67"')
  })
})

describe('theme picks', () => {
  it('keeps only valid picks and drops the rest, so the field falls back to the site', () => {
    expect(cleanEmbedTheme({ colour: 'brand-1', font: 'heading', radius: 'large' })).toEqual({ colour: 'brand-1', font: 'heading', radius: 'large' })
    expect(cleanEmbedTheme({ colour: 'Bad Colour!', font: 'comic', radius: 'huge' })).toEqual({})
    expect(cleanEmbedTheme(null)).toEqual({})
  })

  it('maps the picks to the site design variables and leaves unset picks out', () => {
    const style = embedThemeStyle({ colour: 'brand-1', radius: 'medium', font: 'body' }, new Set(['brand-1']))
    expect(style).toEqual({ '--eg-accent': 'var(--eg-c-brand-1)', '--eg-radius': 'var(--eg-radius-md)', fontFamily: 'var(--font-body)' })
    expect(embedThemeStyle({}, new Set(['brand-1']))).toEqual({})
  })

  it('uses no colour when the palette no longer has it, and square corners for none', () => {
    expect(embedThemeStyle({ colour: 'gone' }, new Set(['brand-1']))).toEqual({})
    expect(embedThemeStyle({ radius: 'none' }, new Set())).toEqual({ '--eg-radius': '0px' })
  })
})

describe('embed keys and origins', () => {
  it('makes a 14 character key from the form key alphabet, never a reserved word', () => {
    const key = newEmbedKey(() => new Uint8Array(14).fill(7))
    expect(key).toHaveLength(14)
    expect(/^[a-hj-km-np-z2-9]+$/.test(key)).toBe(true)
    expect(RESERVED_EMBED_KEYS.has('data')).toBe(true)
  })

  it('drops anything that is not a web origin from an embed list, and de-duplicates', () => {
    expect(cleanEmbedOrigins(['https://a.example', 'https://a.example/', '*', 'javascript:alert(1)', 42])).toEqual(['https://a.example'])
  })
})

describe('embedPathKey', () => {
  it('reads the key from the hosted address and from the older forms address', () => {
    expect(embedPathKey('/embed/abcd2345efgh67')).toBe('abcd2345efgh67')
    expect(embedPathKey('/embed/abcd2345efgh67/')).toBe('abcd2345efgh67')
    expect(embedPathKey('/embed/forms/abcd2345efgh67')).toBe('abcd2345efgh67')
  })

  it('does not treat the loader, the data page or other paths as an embed', () => {
    expect(embedPathKey('/embed/forms.js')).toBeNull()
    expect(embedPathKey('/embed/data/9')).toBeNull()
    expect(embedPathKey('/embed/forms')).toBeNull()
    expect(embedPathKey('/embed/a/b')).toBeNull()
  })
})

describe('decideEmbedFrame', () => {
  it('lets an embed be framed by its own websites, and by no one when it is off or its form is a draft', () => {
    expect(decideEmbedFrame({ enabled: true, allowedOrigins: ['https://partner.example'], formStatus: 'published' })).toEqual({
      frameable: true,
      contentSecurityPolicy: "frame-ancestors 'self' https://partner.example",
    })
    expect(decideEmbedFrame({ enabled: true, allowedOrigins: [], formStatus: null })).toEqual({ frameable: true, contentSecurityPolicy: 'frame-ancestors *' })
    expect(decideEmbedFrame({ enabled: false, allowedOrigins: [], formStatus: 'published' })).toEqual({ frameable: false })
    expect(decideEmbedFrame({ enabled: true, allowedOrigins: [], formStatus: 'draft' })).toEqual({ frameable: false })
    expect(decideEmbedFrame(null)).toEqual({ frameable: false })
  })
})

describe('origin rules for posts', () => {
  const self = 'https://site.example'

  it('accepts a post from this site, or with no Origin, and refuses any other site for a form that is not an embed', () => {
    expect(checkSiteOrigin('https://site.example', self).allowed).toBe(true)
    expect(checkSiteOrigin(null, self).allowed).toBe(true)
    expect(checkSiteOrigin('https://elsewhere.example', self).allowed).toBe(false)
    expect(checkSiteOrigin('null', self).allowed).toBe(false)
  })

  it('checks an embed post against that embed only: an empty list is any website, a list is those websites', () => {
    expect(checkOrigin('https://anyone.example', [], self).allowed).toBe(true)
    expect(checkOrigin('https://partner.example', ['https://partner.example'], self).allowed).toBe(true)
    expect(checkOrigin('https://other.example', ['https://partner.example'], self).allowed).toBe(false)
    expect(checkOrigin('https://site.example', ['https://partner.example'], self).allowed).toBe(true)
  })
})
