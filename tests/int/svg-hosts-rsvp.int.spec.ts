/**
 * SVG uploads (cleaned, behind an admin switch), the Openverse picture host list, and the RSVP guest-details permission.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_UPLOAD_POLICY, inspectUpload, resolveUploadPolicy, UploadRefusal } from '@/features/media/fileTypes'
import { sanitiseSvg } from '@/features/media/svgSanitise'
import { OPENVERSE_IMAGE_HOSTS, resolveImportUrl, resolveOpenverseHosts, StockError, importAllowList } from '@/features/media/stock'
import { applySafeServingHeaders } from '@/localapi/storage'
import { BUILT_IN_ROLES, can, RESOURCES } from '@/features/roles/permissions'
import { resultsTabState } from '@/admin/views/results/resultsTabs'
import { resolveSectionTabs } from '@/admin/list/viewTabs'

const text = (value: string) => new TextEncoder().encode(value)
const svgFile = (name: string, body: string) => ({ name, mimetype: 'image/svg+xml', data: text(body), size: text(body).byteLength })
const SVG_ON = resolveUploadPolicy({ uploads: { allowSvg: true } })

const BENIGN = `<?xml version="1.0" encoding="UTF-8"?>
<!-- an icon -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient>
  </defs>
  <title>Badge</title>
  <g transform="translate(2 2)" opacity="0.9">
    <rect x="0" y="0" width="40" height="40" rx="4" fill="url(#g)"/>
    <circle cx="20" cy="20" r="8" fill="#fff" stroke="black" stroke-width="2"/>
    <path d="M0 0L10 10"/>
    <text x="4" y="58" font-family="Arial" font-size="8">Hi &amp; bye</text>
  </g>
  <a xlink:href="#g"><use xlink:href="#g" x="0" y="0"/></a>
</svg>`

/** Hostile samples: each must come back without the dangerous part, or be refused outright. */
const HOSTILE: Array<{ name: string; body: string; mustNotContain: RegExp[] }> = [
  { name: 'script element', body: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="1" height="1"/></svg>', mustNotContain: [/script/i, /alert/] },
  { name: 'event attribute', body: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="1" height="1" onclick="alert(2)"/></svg>', mustNotContain: [/onload/i, /onclick/i, /alert/] },
  { name: 'foreignObject with HTML', body: '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="10" height="10"><body xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(1)"/></body></foreignObject><rect width="1" height="1"/></svg>', mustNotContain: [/foreignObject/, /onerror/, /<img/, /<body/, /alert/] },
  { name: 'external image href', body: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image href="https://evil.example/x.png" width="5" height="5"/></svg>', mustNotContain: [/evil\.example/] },
  { name: 'external use href', body: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://evil.example/sprite.svg#a"/></svg>', mustNotContain: [/evil\.example/] },
  { name: 'javascript link', body: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a xlink:href="javascript:alert(1)"><rect width="9" height="9"/></a></svg>', mustNotContain: [/javascript/i, /alert/] },
  { name: 'entity-encoded javascript link', body: '<svg xmlns="http://www.w3.org/2000/svg"><a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;alert(1)"><rect width="9" height="9"/></a></svg>', mustNotContain: [/javascript/i, /alert/] },
  { name: 'javascript with tab inside the scheme', body: '<svg xmlns="http://www.w3.org/2000/svg"><a href="java&#x09;script:alert(1)"><rect width="9" height="9"/></a></svg>', mustNotContain: [/script:/i, /alert/] },
  { name: 'html data URL in a link', body: '<svg xmlns="http://www.w3.org/2000/svg"><a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="><rect width="9" height="9"/></a></svg>', mustNotContain: [/data:/, /text\/html/] },
  { name: 'style element with import', body: '<svg xmlns="http://www.w3.org/2000/svg"><style>@import url("https://evil.example/x.css"); rect{fill:url(https://evil.example/f)}</style><rect width="9" height="9"/></svg>', mustNotContain: [/style/, /@import/, /evil\.example/] },
  { name: 'style attribute with url', body: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="9" height="9" style="fill:url(https://evil.example/f)"/></svg>', mustNotContain: [/evil\.example/, /style=/] },
  { name: 'fill with outside url', body: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="9" height="9" fill="url(https://evil.example/f.svg#a)"/></svg>', mustNotContain: [/evil\.example/] },
  { name: 'animation that sets href', body: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><a><animate attributeName="href" values="javascript:alert(1)"/><rect width="9" height="9"/></a></svg>', mustNotContain: [/animate/, /javascript/, /alert/] },
  { name: 'set element', body: '<svg xmlns="http://www.w3.org/2000/svg"><set attributeName="href" to="javascript:alert(1)"/><rect width="9" height="9"/></svg>', mustNotContain: [/<set/, /javascript/] },
  { name: 'css expression', body: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="9" height="9" style="width:expression(alert(1))"/></svg>', mustNotContain: [/expression/, /alert/] },
  { name: 'unknown namespace element', body: '<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="urn:x"><x:script>alert(1)</x:script><rect width="9" height="9"/></svg>', mustNotContain: [/alert/, /x:script/] },
  // CDATA is written as escaped text, so the markup is shown as words and never becomes an element.
  { name: 'CDATA with markup in a text element', body: '<svg xmlns="http://www.w3.org/2000/svg"><text><![CDATA[<script>alert(1)</script>]]></text></svg>', mustNotContain: [/<script/, /<\/script/] },
  { name: 'metadata with an external reference', body: '<svg xmlns="http://www.w3.org/2000/svg"><metadata><x href="https://evil.example"/></metadata><rect width="9" height="9"/></svg>', mustNotContain: [/metadata/, /evil\.example/] },
]

/** Refused outright: these can pull in outside content or hide markup, so the file is turned away. */
const REFUSED: Array<{ name: string; body: string }> = [
  { name: 'DOCTYPE with an external entity', body: '<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><text>&x;</text></svg>' },
  { name: 'DOCTYPE alone', body: '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg xmlns="http://www.w3.org/2000/svg"/>' },
  { name: 'xml-stylesheet processing instruction', body: '<?xml-stylesheet href="https://evil.example/s.xsl" type="text/xsl"?><svg xmlns="http://www.w3.org/2000/svg"/>' },
  { name: 'root is not svg', body: '<html xmlns="http://www.w3.org/1999/xhtml"><body onload="alert(1)"></body></html>' },
  { name: 'unclosed tag', body: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="9"' },
  { name: 'tags not nested', body: '<svg xmlns="http://www.w3.org/2000/svg"><g><rect width="9" height="9"></g></rect></svg>' },
  { name: 'text outside the picture', body: '<svg xmlns="http://www.w3.org/2000/svg"/>hello' },
  { name: 'second top-level element', body: '<svg xmlns="http://www.w3.org/2000/svg"/><svg xmlns="http://www.w3.org/2000/svg"/>' },
  { name: 'unknown named entity', body: '<svg xmlns="http://www.w3.org/2000/svg"><text>&nbsp;</text></svg>' },
  { name: 'unquoted attribute', body: '<svg xmlns="http://www.w3.org/2000/svg"><rect width=9/></svg>' },
  { name: 'empty file', body: '' },
]

const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

describe('sanitiseSvg: hostile samples', () => {
  for (const sample of HOSTILE) {
    it(`removes: ${sample.name}`, () => {
      const result = sanitiseSvg(sample.body)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      for (const pattern of sample.mustNotContain) expect(result.text).not.toMatch(pattern)
      expect(result.text.startsWith('<svg')).toBe(true)
    })
  }

  for (const sample of REFUSED) {
    it(`refuses: ${sample.name}`, () => {
      const result = sanitiseSvg(sample.body)
      expect(result.ok).toBe(false)
    })
  }

  it('refuses bytes that are not UTF-8', () => {
    expect(sanitiseSvg(Uint8Array.from([0x3c, 0x73, 0x76, 0x67, 0xff, 0xfe, 0x3e])).ok).toBe(false)
  })
})

describe('sanitiseSvg: benign pictures', () => {
  it('keeps shapes, gradients, links to fragments, text and the viewBox', () => {
    const result = sanitiseSvg(BENIGN)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.text).toContain('viewBox="0 0 64 64"')
    expect(result.text).toContain('<linearGradient id="g"')
    expect(result.text).toContain('fill="url(#g)"')
    expect(result.text).toContain('<circle cx="20" cy="20" r="8"')
    expect(result.text).toContain('<path d="M0 0L10 10"/>')
    expect(result.text).toContain('Hi &amp; bye')
    expect(result.text).toContain('<a xlink:href="#g">')
    expect(result.text).not.toContain('an icon')
    expect(result.text).not.toContain('<?xml')
  })

  it('keeps an inline raster picture', () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    const result = sanitiseSvg(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image width="1" height="1" xlink:href="data:image/png;base64,${png}"/></svg>`)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.text).toContain(`data:image/png;base64,${png}`)
  })

  it('is idempotent: cleaning a cleaned picture gives the same bytes', () => {
    const once = sanitiseSvg(BENIGN)
    expect(once.ok).toBe(true)
    if (!once.ok) return
    const twice = sanitiseSvg(once.bytes)
    expect(twice.ok).toBe(true)
    if (twice.ok) expect(twice.text).toBe(once.text)
  })

  it('is idempotent on every hostile sample that is kept', () => {
    for (const sample of HOSTILE) {
      const once = sanitiseSvg(sample.body)
      if (!once.ok) continue
      const twice = sanitiseSvg(once.bytes)
      expect(twice.ok, sample.name).toBe(true)
      if (twice.ok) expect(twice.text, sample.name).toBe(once.text)
    }
  })
})

describe('SVG upload policy', () => {
  it('is off by default: the default policy and an unset setting refuse SVG', () => {
    expect(DEFAULT_UPLOAD_POLICY.allowSvg).toBe(false)
    expect(DEFAULT_UPLOAD_POLICY.allowedExtensions).not.toContain('svg')
    expect(resolveUploadPolicy({ uploads: { allowedExtensions: 'svg, pdf' } }).allowedExtensions).toEqual(['pdf'])
    expect(resolveUploadPolicy({}).allowSvg).toBe(false)
  })

  it('refuses an SVG file while the switch is off, whatever the list says', () => {
    expect(() => inspectUpload(svgFile('logo.svg', BENIGN), DEFAULT_UPLOAD_POLICY)).toThrow(UploadRefusal)
    expect(() => inspectUpload(svgFile('logo.svg', BENIGN), DEFAULT_UPLOAD_POLICY)).toThrow(/Allow SVG uploads/)
  })

  it('stores a cleaned copy once the switch is on', () => {
    const hostile = '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>alert(2)</script><rect width="9" height="9"/></svg>'
    const result = inspectUpload(svgFile('logo.svg', hostile), SVG_ON)
    expect(result.mimeType).toBe('image/svg+xml')
    expect(result.name).toBe('logo.svg')
    const stored = decode(result.data)
    expect(stored).not.toMatch(/script|onload|alert/)
    expect(stored).toContain('<rect')
  })

  it('refuses an SVG with a DOCTYPE even when the switch is on', () => {
    const body = '<!DOCTYPE svg [<!ENTITY a "b">]><svg xmlns="http://www.w3.org/2000/svg"/>'
    expect(() => inspectUpload(svgFile('logo.svg', body), SVG_ON)).toThrow(UploadRefusal)
  })

  it('keeps an SVG named .svg out of the library when its bytes are not an SVG', () => {
    expect(() => inspectUpload({ name: 'logo.svg', mimetype: 'image/svg+xml', data: text('hello'), size: 5 }, SVG_ON)).toThrow(UploadRefusal)
  })

  it('a declared SVG type is also refused while the switch is off', () => {
    expect(() => inspectUpload({ name: 'logo', mimetype: 'image/svg+xml', data: text(BENIGN), size: 1 }, DEFAULT_UPLOAD_POLICY)).toThrow(UploadRefusal)
  })

  it('still refuses a script-capable name such as html or xml', () => {
    expect(() => inspectUpload({ name: 'page.html', mimetype: 'text/html', data: text('<p>x</p>'), size: 8 }, SVG_ON)).toThrow(UploadRefusal)
    expect(() => inspectUpload({ name: 'data.xml', mimetype: 'application/xml', data: text('<a/>'), size: 4 }, SVG_ON)).toThrow(UploadRefusal)
  })

  it('serves a stored SVG inline, sandboxed, with nosniff', () => {
    const headers = new Headers({ 'Content-Type': 'image/svg+xml' })
    applySafeServingHeaders(headers, 'logo.svg')
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('Content-Security-Policy')).toContain('sandbox')
    expect(headers.get('Content-Security-Policy')).toContain("default-src 'none'")
    expect(headers.get('Content-Disposition')).toBeNull()
  })
})

describe('Openverse picture host list', () => {
  it('defaults to the built-in list when blank or missing', () => {
    expect(resolveOpenverseHosts(undefined)).toEqual([...OPENVERSE_IMAGE_HOSTS])
    expect(resolveOpenverseHosts('')).toEqual([...OPENVERSE_IMAGE_HOSTS])
    expect(resolveOpenverseHosts('localhost\n10.0.0.1\njavascript:alert(1)')).toEqual([...OPENVERSE_IMAGE_HOSTS])
  })

  it('reads one host per line, lower-cases, removes duplicates and keeps wildcards', () => {
    expect(resolveOpenverseHosts('Images.Example.org\nimages.example.org\n*.cdn.example.net,  photos.example.com')).toEqual([
      'images.example.org',
      '*.cdn.example.net',
      'photos.example.com',
    ])
  })

  it('drops entries that are not a plain host name or are private', () => {
    expect(resolveOpenverseHosts('good.example.org\nhttps://bad.example\n192.168.1.1\nmetadata.internal\n*.com\nbad_host.example')).toEqual([
      'good.example.org',
    ])
  })

  it('an imported picture must be on the editable list, and nothing else', async () => {
    const list = resolveOpenverseHosts('photos.example.org')
    const api = async () => new Response(JSON.stringify({ url: 'https://upload.wikimedia.org/a.jpg' }), { status: 200 })
    await expect(resolveImportUrl({ provider: 'openverse', id: 'abc-1' }, {}, api as unknown as typeof fetch, list)).rejects.toThrow(StockError)
    const api2 = async () => new Response(JSON.stringify({ url: 'https://photos.example.org/a.jpg' }), { status: 200 })
    const url = await resolveImportUrl({ provider: 'openverse', id: 'abc-1' }, {}, api2 as unknown as typeof fetch, list)
    expect(url.hostname).toBe('photos.example.org')
    expect(importAllowList('openverse', list)).toEqual(list)
  })
})

describe('RSVP guest details permission', () => {
  it('is a resource with its own row', () => {
    expect((RESOURCES as readonly string[]).includes('rsvp-guests')).toBe(true)
  })

  it('is off for viewers and customers, on for editors and admins', () => {
    expect(can({ roles: ['viewer'] }, 'rsvp-guests', 'read')).toBe(false)
    expect(can({ roles: [] }, 'rsvp-guests', 'read')).toBe(false)
    expect(can({ roles: ['editor'] }, 'rsvp-guests', 'read')).toBe(true)
    expect(can({ roles: ['admin'] }, 'rsvp-guests', 'read')).toBe(true)
    expect(BUILT_IN_ROLES.viewer['rsvp-guests']).toBeUndefined()
  })

  it('a viewer can open the RSVPs tab (counts) without editing events', () => {
    const access = { isAdmin: false, canRead: (slug: string) => slug === 'event-rsvps', canUpdate: () => false }
    expect(resultsTabState('events', 7, access)?.allowed).toBe(true)
    const tabs = resolveSectionTabs('events', { isAdmin: false, canRead: (slug) => slug === 'event-rsvps', canUpdate: () => false })
    expect(tabs.find((tab) => tab.key === 'rsvps')?.allowed).toBe(true)
  })

  it('a role without Event RSVPs read still cannot open the tab', () => {
    const access = { isAdmin: false, canRead: () => false, canUpdate: () => true }
    expect(resultsTabState('events', 7, access)?.allowed).toBe(false)
  })
})
