/** Task 21f: the blog's RSS 2.0 feed. Pure: posts in, XML out. */

export type FeedPost = { path?: string; title: string; slug: string; date: string; excerpt: string; html: string; author: string; categories: string[]; image?: { url: string; mime?: string } }
export type FeedInput = { title: string; link: string; selfUrl: string; description: string; baseUrl: string; mode: 'summary' | 'full'; posts: FeedPost[]; blogBase?: string }

export const FEED_LIMIT = 30

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
/** CDATA cannot contain "]]>", so split it. */
const cdata = (s: string): string => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`
// XML 1.0 forbids most control characters; drop them rather than emit a feed readers reject.
const clean = (s: string): string => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

const rfc822 = (iso: string): string => {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? new Date(t).toUTCString() : ''
}

export function buildRss(input: FeedInput): string {
  const items = input.posts.slice(0, FEED_LIMIT).map((p) => {
    const url = p.path ? `${input.baseUrl}${p.path}` : `${input.baseUrl}/${input.blogBase || 'blog'}/${encodeURIComponent(p.slug)}`
    const date = rfc822(p.date)
    return [
      '<item>',
      `<title>${esc(clean(p.title))}</title>`,
      `<link>${esc(url)}</link>`,
      `<guid isPermaLink="true">${esc(url)}</guid>`,
      date ? `<pubDate>${date}</pubDate>` : '',
      p.author ? `<dc:creator>${esc(clean(p.author))}</dc:creator>` : '',
      ...p.categories.map((c) => `<category>${esc(clean(c))}</category>`),
      `<description>${cdata(clean(p.excerpt))}</description>`,
      p.image ? `<enclosure url="${esc(p.image.url)}" length="0" type="${esc(p.image.mime || 'image/jpeg')}"/><media:content url="${esc(p.image.url)}" medium="image"/>` : '',
      input.mode === 'full' && p.html ? `<content:encoded>${cdata(clean(p.html))}</content:encoded>` : '',
      '</item>',
    ].filter(Boolean).join('')
  })
  const newest = input.posts.map((p) => Date.parse(p.date)).filter(Number.isFinite).sort((a, b) => b - a)[0]
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">',
    '<channel>',
    `<title>${esc(clean(input.title))}</title>`,
    `<link>${esc(input.link)}</link>`,
    `<description>${esc(clean(input.description))}</description>`,
    `<atom:link href="${esc(input.selfUrl)}" rel="self" type="application/rss+xml"/>`,
    newest ? `<lastBuildDate>${new Date(newest).toUTCString()}</lastBuildDate>` : '',
    ...items,
    '</channel>',
    '</rss>',
  ].filter(Boolean).join('\n')
}

type LexNode = { type?: string; text?: string; format?: number; tag?: string; url?: string; listType?: string; children?: LexNode[] }

/** Lexical rich text to simple HTML (paragraphs, headings, lists, quotes, links, bold, italic, code). Unknown nodes keep their text. */
export function lexicalToHtml(value: unknown): string {
  const root = (value as { root?: LexNode } | null)?.root
  if (!root || !Array.isArray(root.children)) return ''
  const render = (n: LexNode): string => {
    const kids = (n.children ?? []).map(render).join('')
    switch (n.type) {
      case 'text': {
        let t = esc(n.text ?? '')
        const f = n.format ?? 0
        if (f & 16) t = `<code>${t}</code>`
        if (f & 1) t = `<strong>${t}</strong>`
        if (f & 2) t = `<em>${t}</em>`
        return t
      }
      case 'linebreak': return '<br/>'
      case 'paragraph': return kids ? `<p>${kids}</p>` : ''
      case 'heading': return /^h[1-6]$/.test(n.tag ?? '') ? `<${n.tag}>${kids}</${n.tag}>` : `<h2>${kids}</h2>`
      case 'quote': return `<blockquote>${kids}</blockquote>`
      case 'list': { const tag = n.listType === 'number' ? 'ol' : 'ul'; return `<${tag}>${kids}</${tag}>` }
      case 'listitem': return `<li>${kids}</li>`
      case 'link': case 'autolink': return n.url && /^https?:\/\//i.test(n.url) ? `<a href="${esc(n.url)}">${kids}</a>` : kids
      default: return kids
    }
  }
  return root.children.map(render).join('')
}
