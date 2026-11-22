/**
 * Reads the facts the SEO crawl, the accessibility review and the snippet panel need from one page of HTML.
 * Pure and dependency free (a Worker has no DOM): a small tag scanner, defensive about odd markup.
 */

export type Heading = { level: number; text: string }
export type ImageFact = { src: string; alt: string | null; width: boolean; height: boolean; decorative: boolean }
export type LinkFact = { href: string; text: string; label: string; rel: string; hasImageWithAlt: boolean }
export type HtmlFacts = {
  bytes: number
  doctype: boolean
  lang: string
  charset: boolean
  title: string
  metaDescription: string | null
  viewport: boolean
  canonical: string | null
  robots: string
  hreflang: { lang: string; href: string }[]
  favicon: boolean
  og: Record<string, string>
  twitterCard: boolean
  headings: Heading[]
  landmarks: { main: number; nav: number; header: number; footer: number }
  images: ImageFact[]
  links: LinkFact[]
  buttonsWithoutName: number
  inputsWithoutLabel: number
  iframesWithoutTitle: number
  duplicateIds: string[]
  positiveTabindex: number
  ariaHiddenFocusable: number
  badAriaRoles: string[]
  skipLink: boolean
  jsonLd: unknown[]
  jsonLdInvalid: number
  text: string
  wordCount: number
  hash: string
  lists: number
  tables: number
  tablesWithHeaders: number
  videos: number
  mixedContent: number
  questionAnswer: boolean
  externalScripts: number
}

const VALID_ROLES = new Set(['alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell', 'checkbox', 'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition', 'dialog', 'directory', 'document', 'feed', 'figure', 'form', 'grid', 'gridcell', 'group', 'heading', 'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'menu', 'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'navigation', 'none', 'note', 'option', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider', 'spinbutton', 'status', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem'])

const decode = (value: string): string =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCharCode(Number(n)))

const strip = (html: string): string => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

/** Attributes of one opening tag, lower-cased names. A bare attribute reads as an empty string. */
export function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  const inner = tag.replace(/^<\s*[a-z0-9-]+/i, '').replace(/\/?>$/, '')
  let m: RegExpExecArray | null
  while ((m = re.exec(inner))) {
    const name = m[1].toLowerCase()
    if (!(name in out)) out[name] = decode(m[2] ?? m[3] ?? m[4] ?? '')
  }
  return out
}

/** A fast, stable 32-bit hash (FNV-1a), hex. Used to spot duplicate content, not for security. */
export function contentHash(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const FOCUSABLE = /^(a|button|input|select|textarea)$/i

export function parseHtmlFacts(html: string): HtmlFacts {
  const bytes = html.length
  const noScript = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => (/application\/ld\+json/i.test(m.slice(0, 200)) ? m : ' ')).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')

  const jsonLd: unknown[] = []
  let jsonLdInvalid = 0
  const ldRe = /<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi
  let ld: RegExpExecArray | null
  while ((ld = ldRe.exec(html))) {
    try {
      jsonLd.push(JSON.parse(ld[1].trim()))
    } catch {
      jsonLdInvalid += 1
    }
  }
  const body = noScript.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')

  const htmlTag = /<html\b[^>]*>/i.exec(html)?.[0] ?? ''
  const head = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)?.[1] ?? html
  const metaTags = head.match(/<meta\b[^>]*>/gi) ?? []
  const linkTags = head.match(/<link\b[^>]*>/gi) ?? []
  const metas = metaTags.map(attrsOf)
  const metaByName = (name: string): string | null => {
    const found = metas.find((a) => (a.name ?? '').toLowerCase() === name)
    return found ? (found.content ?? '') : null
  }
  const og: Record<string, string> = {}
  for (const a of metas) if ((a.property ?? '').toLowerCase().startsWith('og:')) og[a.property.toLowerCase()] = a.content ?? ''
  const links = linkTags.map(attrsOf)
  const rels = (value: string): string[] => value.toLowerCase().split(/\s+/)

  const headings: Heading[] = []
  const hRe = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi
  let h: RegExpExecArray | null
  while ((h = hRe.exec(body))) headings.push({ level: Number(h[1]), text: strip(h[2]) })

  const images: ImageFact[] = []
  for (const tag of body.match(/<img\b[^>]*>/gi) ?? []) {
    const a = attrsOf(tag)
    const decorative = a.role === 'presentation' || a.role === 'none' || a['aria-hidden'] === 'true'
    images.push({ src: a.src ?? a['data-src'] ?? '', alt: 'alt' in a ? a.alt : null, width: !!a.width, height: !!a.height, decorative })
  }

  const anchors: LinkFact[] = []
  const aRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  let a: RegExpExecArray | null
  while ((a = aRe.exec(body))) {
    const at = attrsOf(`<a ${a[1]}>`)
    if (!('href' in at)) continue
    const inner = a[2]
    const imgAlt = (inner.match(/<img\b[^>]*>/gi) ?? []).some((t) => (attrsOf(t).alt ?? '').trim().length > 0)
    anchors.push({ href: at.href, text: strip(inner), label: (at['aria-label'] ?? at.title ?? '').trim(), rel: at.rel ?? '', hasImageWithAlt: imgAlt })
  }

  let buttonsWithoutName = 0
  const bRe = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi
  let b: RegExpExecArray | null
  while ((b = bRe.exec(body))) {
    const at = attrsOf(`<button ${b[1]}>`)
    const named = strip(b[2]).length > 0 || (at['aria-label'] ?? '').trim() || (at['aria-labelledby'] ?? '').trim() || (at.title ?? '').trim() || /<img\b[^>]*alt=["'][^"']+/i.test(b[2])
    if (!named) buttonsWithoutName += 1
  }

  const labelFor = new Set<string>()
  for (const l of body.match(/<label\b[^>]*>/gi) ?? []) {
    const f = attrsOf(l).for
    if (f) labelFor.add(f)
  }
  const wrapped = body.match(/<label\b[^>]*>[\s\S]*?<\/label>/gi) ?? []
  let inputsWithoutLabel = 0
  for (const tag of body.match(/<(input|select|textarea)\b[^>]*>/gi) ?? []) {
    const at = attrsOf(tag)
    const type = (at.type ?? 'text').toLowerCase()
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue
    if ((at['aria-label'] ?? '').trim() || (at['aria-labelledby'] ?? '').trim() || (at.title ?? '').trim()) continue
    if (at.id && labelFor.has(at.id)) continue
    if (wrapped.some((w) => w.includes(tag))) continue
    inputsWithoutLabel += 1
  }

  let iframesWithoutTitle = 0
  for (const tag of body.match(/<iframe\b[^>]*>/gi) ?? []) if (!(attrsOf(tag).title ?? '').trim()) iframesWithoutTitle += 1

  const seen = new Map<string, number>()
  let positiveTabindex = 0
  let ariaHiddenFocusable = 0
  const badRoles = new Set<string>()
  for (const tag of body.match(/<[a-z][a-z0-9-]*\b[^>]*>/gi) ?? []) {
    const at = attrsOf(tag)
    if (at.id) seen.set(at.id, (seen.get(at.id) ?? 0) + 1)
    if (at.tabindex && Number(at.tabindex) > 0) positiveTabindex += 1
    const name = /^<([a-z0-9-]+)/i.exec(tag)?.[1] ?? ''
    if (at['aria-hidden'] === 'true' && (FOCUSABLE.test(name) && at.tabindex !== '-1')) ariaHiddenFocusable += 1
    if (at.role) for (const role of at.role.toLowerCase().split(/\s+/)) if (role && !VALID_ROLES.has(role)) badRoles.add(role)
  }

  const count = (re: RegExp): number => (body.match(re) ?? []).length
  const tableTags = body.match(/<table\b[\s\S]*?<\/table>/gi) ?? []
  const text = strip(body.replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' '))
  const words = text ? text.split(/\s+/).length : 0

  // A short direct answer under a question heading: a heading that is a question followed by a paragraph of 20 to 60 words.
  let questionAnswer = false
  const qRe = /<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>\s*<p\b[^>]*>([\s\S]*?)<\/p>/gi
  let q: RegExpExecArray | null
  while ((q = qRe.exec(body))) {
    const heading = strip(q[1])
    const paragraph = strip(q[2]).split(/\s+/).filter(Boolean).length
    if (/\?\s*$/.test(heading) || /^(what|why|how|when|where|who|which|can|does|do|is|are)\b/i.test(heading)) if (paragraph >= 15 && paragraph <= 80) questionAnswer = true
  }

  return {
    bytes,
    doctype: /^\s*<!doctype\s+html/i.test(html),
    lang: (attrsOf(htmlTag).lang ?? '').trim(),
    charset: metas.some((m) => 'charset' in m || /charset=/i.test(m.content ?? '')) || /charset=/i.test(head),
    title: strip(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1] ?? ''),
    metaDescription: metaByName('description'),
    viewport: metas.some((m) => (m.name ?? '').toLowerCase() === 'viewport'),
    canonical: links.find((l) => rels(l.rel ?? '').includes('canonical'))?.href ?? null,
    robots: (metaByName('robots') ?? '').toLowerCase(),
    hreflang: links.filter((l) => rels(l.rel ?? '').includes('alternate') && l.hreflang).map((l) => ({ lang: l.hreflang, href: l.href ?? '' })),
    favicon: links.some((l) => rels(l.rel ?? '').some((r) => r === 'icon' || r === 'apple-touch-icon' || r === 'shortcut')),
    og,
    twitterCard: metas.some((m) => (m.name ?? '').toLowerCase() === 'twitter:card'),
    headings,
    landmarks: { main: count(/<main\b|role=["']main["']/gi), nav: count(/<nav\b/gi), header: count(/<header\b/gi), footer: count(/<footer\b/gi) },
    images,
    links: anchors,
    buttonsWithoutName,
    inputsWithoutLabel,
    iframesWithoutTitle,
    duplicateIds: [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id).slice(0, 10),
    positiveTabindex,
    ariaHiddenFocusable,
    badAriaRoles: [...badRoles].slice(0, 10),
    skipLink: anchors.slice(0, 5).some((l) => l.href.startsWith('#') && /skip|jump/i.test(l.text)),
    jsonLd,
    jsonLdInvalid,
    text,
    wordCount: words,
    hash: contentHash(text),
    lists: count(/<(ul|ol)\b/gi),
    tables: tableTags.length,
    tablesWithHeaders: tableTags.filter((t) => /<th\b/i.test(t)).length,
    videos: count(/<video\b/gi) + count(/<iframe\b[^>]*(youtube|vimeo)/gi),
    mixedContent: count(/\s(src|href)=["']http:\/\//gi),
    questionAnswer,
    externalScripts: count(/<script\b[^>]*\ssrc=/gi),
  }
}
